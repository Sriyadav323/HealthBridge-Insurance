package com.healthbridge.backend.admin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.healthbridge.backend.admin.AdminModels.*;

@Service
public class AdminMemberService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final PasswordSetupService setup;
    private final InsurancePlanService insurancePlans;
    private static final String DIRECTORY = """
        FROM members m LEFT JOIN member_accounts a ON a.member_id=m.member_id
        WHERE NOT EXISTS (SELECT 1 FROM account_roles r WHERE r.member_id=m.member_id AND r.role_name='ADMIN')
        """;
    private static final String COLUMNS = """
        SELECT m.member_id, m.full_name, COALESCE(a.email, m.email) AS email, m.phone,
        m.address, m.plan_name, m.plan_type, m.coverage_status, a.enabled,
        COALESCE(a.password_setup_required, false) AS password_setup_required, m.registered_at, m.version
        """;

    public AdminMemberService(JdbcTemplate jdbc, PasswordEncoder passwords, PasswordSetupService setup, InsurancePlanService insurancePlans) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.setup = setup;
        this.insurancePlans = insurancePlans;
    }

    public List<InsurancePlanService.Plan> plans() { return insurancePlans.list(true); }

    public Dashboard dashboard() {
        var counts = jdbc.queryForMap("""
            SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE m.coverage_status='Active') AS active,
            COUNT(*) FILTER (WHERE m.coverage_status='Inactive') AS inactive,
            COUNT(*) FILTER (WHERE a.enabled=true) AS enabled
            """ + DIRECTORY);
        var recent = jdbc.query(COLUMNS + DIRECTORY + " AND m.registered_at IS NOT NULL ORDER BY m.registered_at DESC, m.member_id DESC LIMIT 5",
            (row, index) -> summary(row));
        return new Dashboard(number(counts.get("total")), number(counts.get("active")), number(counts.get("inactive")), number(counts.get("enabled")), recent);
    }

    public MemberPage list(String search, String coverage, String account, int page, int size, String sort) {
        StringBuilder where = new StringBuilder(DIRECTORY);
        List<Object> args = new ArrayList<>();
        if (!search.isBlank()) {
            where.append(" AND strpos(lower(concat_ws(' ',m.member_id,m.full_name,COALESCE(a.email,m.email))),lower(?)) > 0");
            args.add(search.strip());
        }
        if (!coverage.isEmpty()) { where.append(" AND m.coverage_status=?"); args.add(coverage); }
        where.append(switch (account) {
            case "enabled" -> " AND a.enabled=true AND a.password_setup_required=false";
            case "disabled" -> " AND a.enabled=false AND a.password_setup_required=false";
            case "pending" -> " AND a.password_setup_required=true";
            case "missing" -> " AND a.member_id IS NULL";
            default -> "";
        });
        Long total = jdbc.queryForObject("SELECT COUNT(*) " + where, Long.class, args.toArray());
        args.add(size);
        args.add((long) page * size);
        String order = switch (sort) {
            case "oldest" -> "m.registered_at ASC NULLS LAST,m.member_id";
            case "name-asc" -> "lower(m.full_name) ASC,m.member_id";
            case "name-desc" -> "lower(m.full_name) DESC,m.member_id";
            case "plan-asc" -> "lower(m.plan_name) ASC,lower(m.full_name),m.member_id";
            default -> "m.registered_at DESC NULLS LAST,m.member_id";
        };
        var items = jdbc.query(COLUMNS + where + " ORDER BY " + order + " LIMIT ? OFFSET ?",
            (row, index) -> summary(row), args.toArray());
        long count = total == null ? 0 : total;
        return new MemberPage(items, count, Math.ceilDiv(count, size), page, size);
    }

    public MemberDetails details(String memberId) { return read(memberId, false); }

    private MemberDetails read(String memberId, boolean lock) {
        var rows = jdbc.query(COLUMNS + DIRECTORY + " AND m.member_id=?" + (lock ? " FOR UPDATE OF m" : ""),
            (row, index) -> new MemberDetails(summary(row), row.getString("address")), memberId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found.");
        return rows.getFirst();
    }

    @Transactional
    public Registration register(MemberWrite input) {
        var plan = insurancePlans.resolve(input.planId(), input.planName(), input.planType());
        String memberId = "HB" + UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase(Locale.ROOT);
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        jdbc.update("""
            INSERT INTO members(member_id,full_name,email,phone,address,plan_name,plan_type,coverage_status)
            VALUES (?,?,?,?,?,?,?,?)
            """, memberId, input.fullName().strip(), email, input.phone().strip(), input.address().strip(),
            input.planName().strip(), input.planType(), input.coverageStatus());
        jdbc.update("""
            INSERT INTO member_accounts(member_id,email,password_hash,enabled,password_setup_required)
            VALUES (?,?,?,false,true)
            """, memberId, email, passwords.encode(UUID.randomUUID().toString()));
        insurancePlans.assign(memberId, plan, true);
        // Role is assigned exclusively on the server. No role field is accepted from the form.
        jdbc.queryForList("SELECT public.enroll_member_role(?)", memberId);
        SetupLink link = setup.issue(memberId);
        return new Registration(details(memberId), link.token(), link.expiresAt());
    }

    @Transactional
    public MemberDetails update(String memberId, MemberWrite input) {
        MemberDetails before = read(memberId, true);
        checkVersion(input.version(), before.summary().version());
        boolean planChanged = !input.planName().strip().equals(before.summary().planName()) || !input.planType().equals(before.summary().planType());
        var plan = planChanged || input.planId()!=null ? insurancePlans.resolve(input.planId(),input.planName(),input.planType()) : null;
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        jdbc.update("""
            UPDATE members SET full_name=?,email=?,phone=?,address=?,plan_name=?,plan_type=?,coverage_status=?,version=version+1,
            benefits_review_required=benefits_review_required OR ?
            WHERE member_id=?
            """, input.fullName().strip(), email, input.phone().strip(), input.address().strip(), input.planName().strip(),
            input.planType(), input.coverageStatus(),
            !input.planName().strip().equals(before.summary().planName()) || !input.planType().equals(before.summary().planType()), memberId);
        if (plan != null) insurancePlans.assign(memberId,plan,false);
        boolean emailChanged = !email.equalsIgnoreCase(before.summary().email());
        jdbc.update("UPDATE member_accounts SET email=?,session_version=session_version+? WHERE member_id=?",
            email, emailChanged ? 1 : 0, memberId);
        if (emailChanged) jdbc.update("UPDATE account_password_setup SET used_at=CURRENT_TIMESTAMP WHERE member_id=?", memberId);
        return details(memberId);
    }

    @Transactional
    public MemberDetails account(String memberId, AccountUpdate input) {
        MemberDetails before = read(memberId, true);
        checkVersion(input.version(), before.summary().version());
        if (before.summary().accountEnabled() == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "This member has no login account.");
        if (input.enabled() && before.summary().passwordSetupRequired()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The member must complete password setup before login can be enabled.");
        }
        jdbc.update("UPDATE member_accounts SET enabled=?,session_version=session_version+1 WHERE member_id=?", input.enabled(), memberId);
        if (!input.enabled()) jdbc.update("UPDATE account_password_setup SET used_at=CURRENT_TIMESTAMP WHERE member_id=?", memberId);
        jdbc.update("UPDATE members SET version=version+1 WHERE member_id=?", memberId);
        return details(memberId);
    }

    @Transactional
    public Registration reissue(String memberId, VersionRequest input) {
        MemberDetails before = read(memberId, true);
        checkVersion(input.version(), before.summary().version());
        if (!before.summary().passwordSetupRequired()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Password setup is already complete. This action cannot reset an existing password.");
        SetupLink link = setup.issue(memberId);
        jdbc.update("UPDATE members SET version=version+1 WHERE member_id=?", memberId);
        return new Registration(details(memberId), link.token(), link.expiresAt());
    }

    private void checkVersion(Long requested, long actual) {
        if (requested == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A record version is required.");
        if (requested != actual) throw new ResponseStatusException(HttpStatus.CONFLICT, "This member changed. Reload the record before saving.");
    }

    private static long number(Object value) { return ((Number) value).longValue(); }

    private static MemberSummary summary(ResultSet row) throws SQLException {
        var registered = row.getTimestamp("registered_at");
        return new MemberSummary(row.getString("member_id"), row.getString("full_name"), row.getString("email"), row.getString("phone"),
            row.getString("plan_name"), row.getString("plan_type"), row.getString("coverage_status"), (Boolean) row.getObject("enabled"),
            row.getBoolean("password_setup_required"), registered == null ? null : registered.toInstant().toString(), row.getLong("version"));
    }
}
