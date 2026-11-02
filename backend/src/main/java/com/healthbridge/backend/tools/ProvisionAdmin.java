package com.healthbridge.backend.tools;

import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Trusted local operator tool; no HTTP administrator-registration endpoint exists. */
public final class ProvisionAdmin {
    private ProvisionAdmin() {}
    public static void main(String[] args) {
        Console console = System.console();
        if (console == null) {
            System.err.println("Administrator provisioning requires an interactive terminal. No passwords accepted as arguments.");
            System.exit(1);
            return;
        }
        char[] password = null;
        char[] confirmation = null;
        try {
            String name = console.readLine("Synthetic administrator full name: ").strip();
            String email = console.readLine("Administrator login email: ").strip().toLowerCase(Locale.ROOT);
            password = console.readPassword("New administrator password (12+ characters, hidden): ");
            confirmation = console.readPassword("Confirm password (hidden): ");
            if (name.isBlank() || name.length() > 150 || email.length() > 255
                    || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || password == null || password.length < 12
                    || !Arrays.equals(password, confirmation) || new String(password).getBytes(StandardCharsets.UTF_8).length > 72) {
                throw new IllegalArgumentException("Invalid input");
            }
            String id = "HA" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase(Locale.ROOT);
            String hash = new BCryptPasswordEncoder().encode(new String(password));
            try (var connection = DriverManager.getConnection(
                    System.getenv().getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/healthbridge"),
                    System.getenv("DB_USERNAME"), System.getenv("DB_PASSWORD"))) {
                connection.setAutoCommit(false);
                try {
                    try (var insert = connection.prepareStatement("""
                        INSERT INTO members(member_id,full_name,email,plan_name,plan_type,coverage_status)
                        VALUES (?,?,?,'Administrative account','PPO','Inactive')
                        """)) {
                        insert.setString(1,id); insert.setString(2,name); insert.setString(3,email); insert.executeUpdate();
                    }
                    try (var insert = connection.prepareStatement("INSERT INTO member_accounts(member_id,email,password_hash,enabled) VALUES (?,?,?,true)")) {
                        insert.setString(1,id); insert.setString(2,email); insert.setString(3,hash); insert.executeUpdate();
                    }
                    try (var insert = connection.prepareStatement("INSERT INTO account_roles(member_id,role_name) VALUES (?,'ADMIN')")) {
                        insert.setString(1,id); insert.executeUpdate();
                    }
                    connection.commit();
                    console.printf("Administrator created. Existing accounts were not modified.%n");
                } catch (Exception exception) { connection.rollback(); throw exception; }
            }
        } catch (Exception exception) {
            console.printf("Administrator not created. Check input, unique email, migration, and database-owner permissions.%n");
            System.exit(1);
        } finally {
            if (password != null) Arrays.fill(password, '\0');
            if (confirmation != null) Arrays.fill(confirmation, '\0');
        }
    }
}
