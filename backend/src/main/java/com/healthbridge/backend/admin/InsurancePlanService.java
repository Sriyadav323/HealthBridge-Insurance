package com.healthbridge.backend.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class InsurancePlanService {
    public record Coverage(@NotBlank @Size(max=150) String name,
        @NotNull @Pattern(regexp="Medical|Pharmacy") String category,
        @NotNull @Pattern(regexp="Covered|Not Covered") String status,
        @NotBlank @Size(max=100) String cost, @NotNull @Size(max=2000) String notes) {}
    public record Write(@NotBlank @Size(max=150) String planName,
        @NotNull @Pattern(regexp="PPO|HMO|EPO") String planType,
        @NotNull LocalDate effectiveFrom, @NotNull LocalDate effectiveTo,
        @NotNull @Min(0) @Max(1000000) Integer deductibleTotal,
        @NotNull @Min(0) @Max(1000000) Integer oopMaximum,
        @NotNull @Min(0) @Max(1000000) Integer primaryCare,
        @NotNull @Min(0) @Max(1000000) Integer specialist,
        @NotNull @Min(0) @Max(1000000) Integer urgentCare,
        @NotEmpty @Size(max=100) List<@NotNull @Valid Coverage> coverage) {}
    public record Plan(long id, String planName, String planType, LocalDate effectiveFrom, LocalDate effectiveTo,
        boolean retired, int deductibleTotal, int oopMaximum, int primaryCare, int specialist, int urgentCare,
        List<Coverage> coverage) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public InsurancePlanService(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    private Plan map(java.sql.ResultSet r) throws java.sql.SQLException {
        return new Plan(r.getLong("id"), r.getString("plan_name"), r.getString("plan_type"),
            r.getDate("effective_from").toLocalDate(), r.getDate("effective_to").toLocalDate(),r.getBoolean("retired"),
            r.getInt("deductible_total"),r.getInt("oop_maximum"),r.getInt("copay_primary_care"),r.getInt("copay_specialist"),r.getInt("copay_urgent_care"),
            List.of(json.readValue(r.getString("coverage"),Coverage[].class)));
    }
    public List<Plan> list(boolean availableOnly) {
        return jdbc.query("SELECT * FROM insurance_plans" + (availableOnly ? " WHERE retired=false AND CURRENT_DATE BETWEEN effective_from AND effective_to" : "") + " ORDER BY plan_name,effective_from DESC,id DESC", (r,i)->map(r));
    }
    @Transactional
    public Plan create(Write w) {
        if(w.effectiveTo().isBefore(w.effectiveFrom()) || w.effectiveFrom().getYear()!=w.effectiveTo().getYear() || w.oopMaximum()<w.deductibleTotal())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use an effective period within one calendar benefit year, and an out-of-pocket maximum at least equal to the deductible.");
        Long id=jdbc.queryForObject("""
            INSERT INTO insurance_plans(plan_name,plan_type,effective_from,effective_to,deductible_total,oop_maximum,
                copay_primary_care,copay_specialist,copay_urgent_care,coverage)
            VALUES(?,?,?,?,?,?,?,?,?,?::jsonb) RETURNING id
            """,Long.class,w.planName().strip(),w.planType(),w.effectiveFrom(),w.effectiveTo(),w.deductibleTotal(),w.oopMaximum(),w.primaryCare(),w.specialist(),w.urgentCare(),json.writeValueAsString(w.coverage()));
        return jdbc.query("SELECT * FROM insurance_plans WHERE id=?",(r,i)->map(r),id).getFirst();
    }
    @Transactional
    public void retire(long id) {
        if(jdbc.update("UPDATE insurance_plans SET retired=true WHERE id=?",id)==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Plan not found.");
    }
    public Plan resolve(Long id,String name,String type) {
        var rows=jdbc.query("SELECT * FROM insurance_plans WHERE " + (id==null?"plan_name=? AND plan_type=?":"id=?") + " AND retired=false AND CURRENT_DATE BETWEEN effective_from AND effective_to FOR SHARE",
            (r,i)->map(r),id==null?new Object[]{name.strip(),type}:new Object[]{id});
        if(rows.size()!=1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select a current, published insurance plan. If several versions are available, select a specific version.");
        var p=rows.getFirst();
        if(!p.planName().equals(name.strip())||!p.planType().equals(type)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The selected plan does not match its name and type.");
        return p;
    }
    // Called in the member write transaction. Snapshots protect existing members from later plan revisions.
    public void assign(String memberId,Plan p,boolean fresh) {
        int year=p.effectiveFrom().getYear();
        var years=jdbc.queryForList("SELECT benefit_year FROM members WHERE member_id=?",memberId);
        boolean reset=fresh || (!years.isEmpty() && years.getFirst().get("benefit_year") instanceof Number n && n.intValue()!=year);
        jdbc.update("""
            INSERT INTO member_benefits(member_id,deductible_total,deductible_met,oop_maximum,oop_spent,copay_primary_care,copay_specialist,copay_urgent_care)
            VALUES(?,?,0,?,0,?,?,?) ON CONFLICT(member_id) DO UPDATE SET
            deductible_total=EXCLUDED.deductible_total,oop_maximum=EXCLUDED.oop_maximum,
            copay_primary_care=EXCLUDED.copay_primary_care,copay_specialist=EXCLUDED.copay_specialist,copay_urgent_care=EXCLUDED.copay_urgent_care,
            deductible_met=CASE WHEN ? THEN 0 ELSE member_benefits.deductible_met END,
            oop_spent=CASE WHEN ? THEN 0 ELSE member_benefits.oop_spent END
            """,memberId,p.deductibleTotal(),p.oopMaximum(),p.primaryCare(),p.specialist(),p.urgentCare(),reset,reset);
        jdbc.update("DELETE FROM coverage_items WHERE member_id=?",memberId);
        int order=0;
        for(var c:p.coverage()) jdbc.update("INSERT INTO coverage_items(id,member_id,category,name,status,cost,notes,display_order) VALUES(?,?,?,?,?,?,?,?)",
            UUID.randomUUID().toString().replace("-","").substring(0,20),memberId,c.category(),c.name(),c.status(),c.cost(),c.notes(),++order);
        jdbc.update("UPDATE members SET insurance_plan_id=?,coverage_effective_from=?,coverage_effective_to=?,benefit_year=?,benefits_review_required=false WHERE member_id=?",
            p.id(),p.effectiveFrom(),p.effectiveTo(),year,memberId);
    }
}
