package com.healthbridge.backend.tools;

import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.Arrays;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Explicit, interactive provisioning tool. Never runs at application startup. */
public final class ProvisionDemoAccount {
    private ProvisionDemoAccount() {}

    public static void main(String[] args) {
        Console console = System.console();
        if (console == null) {
            System.err.println("Run this tool in an interactive terminal; passwords are never accepted as arguments.");
            System.exit(1);
            return;
        }
        char[] password = null;
        char[] confirmation = null;
        try {
            String memberId = console.readLine("Existing synthetic member ID: ").strip();
            String email = console.readLine("Demo account email: ").strip().toLowerCase(java.util.Locale.ROOT);
            password = console.readPassword("New password (12+ characters, hidden): ");
            confirmation = console.readPassword("Confirm password (hidden): ");
            if (memberId.isEmpty() || memberId.length() > 30 || email.length() > 255
                    || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                    || password == null || password.length < 12 || !Arrays.equals(password, confirmation)
                    || new String(password).getBytes(StandardCharsets.UTF_8).length > 72) {
                console.printf("Invalid input or passwords do not match. No changes made.%n");
                System.exit(1);
            }
            String hash = new BCryptPasswordEncoder().encode(new String(password));
            String url = System.getenv().getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/healthbridge");
            try (var connection = DriverManager.getConnection(url, System.getenv("DB_USERNAME"), System.getenv("DB_PASSWORD"))) {
                connection.setAutoCommit(false);
                try (var statement = connection.prepareStatement("""
                    INSERT INTO member_accounts (member_id, email, password_hash, enabled)
                    SELECT member_id, ?, ?, true FROM members WHERE member_id = ?
                    ON CONFLICT DO NOTHING
                    """)) {
                    statement.setString(1, email); statement.setString(2, hash); statement.setString(3, memberId);
                    if (statement.executeUpdate() == 1) {
                        try (var role = connection.prepareStatement("SELECT public.enroll_member_role(?)")) {
                            role.setString(1,memberId); role.execute();
                        }
                        connection.commit();
                        console.printf("Demo member account created.%n");
                    } else {
                        connection.rollback();
                        console.printf("No changes made: member missing or account/email already exists.%n");
                    }
                } catch (Exception exception) { connection.rollback(); throw exception; }
            }
        } catch (Exception exception) {
            // JDBC messages can contain SQL or connection details; do not print them.
            console.printf("Account provisioning failed. Check database access and the synthetic member ID.%n");
            System.exit(1);
        } finally {
            if (password != null) Arrays.fill(password, '\0');
            if (confirmation != null) Arrays.fill(confirmation, '\0');
        }
    }
}
