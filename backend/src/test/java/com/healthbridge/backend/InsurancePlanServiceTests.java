package com.healthbridge.backend;

import com.healthbridge.backend.admin.InsurancePlanService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class InsurancePlanServiceTests {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    InsurancePlanService service=new InsurancePlanService(jdbc,new ObjectMapper());
    InsurancePlanService.Plan plan=new InsurancePlanService.Plan(1L,"Test PPO","PPO",LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),false,1500,5000,25,50,75,
        List.of(new InsurancePlanService.Coverage("Preventive","Medical","Covered","$0","In network")));
    @Test void preservesSameYearSpendingOnPlanChange() {
        when(jdbc.queryForList(anyString(),anyString())).thenReturn(List.of(Map.of("benefit_year",2026)));
        service.assign("MEMBER",plan,false);
        verify(jdbc).update(contains("INSERT INTO member_benefits"),eq("MEMBER"),eq(1500),eq(5000),eq(25),eq(50),eq(75),eq(false),eq(false));
        verify(jdbc).update(contains("benefits_review_required=false"),eq(1L),eq(plan.effectiveFrom()),eq(plan.effectiveTo()),eq(2026),eq("MEMBER"));
    }
    @Test void resetsSpendingForAnExplicitNewBenefitYear() {
        when(jdbc.queryForList(anyString(),anyString())).thenReturn(List.of(Map.of("benefit_year",2025)));
        service.assign("MEMBER",plan,false);
        verify(jdbc).update(contains("INSERT INTO member_benefits"),eq("MEMBER"),eq(1500),eq(5000),eq(25),eq(50),eq(75),eq(true),eq(true));
    }
    @Test void newEnrollmentStartsAtZero() {
        service.assign("MEMBER",plan,true);
        verify(jdbc).update(contains("VALUES(?,?,0,?,0,?,?,?)"),eq("MEMBER"),eq(1500),eq(5000),eq(25),eq(50),eq(75),eq(true),eq(true));
    }
    @Test void rejectsInvalidAnnualDatesBeforeWriting() {
        var input=new InsurancePlanService.Write("Test","PPO",LocalDate.of(2026,1,1),LocalDate.of(2027,1,1),1500,5000,25,50,75,plan.coverage());
        assertThrows(ResponseStatusException.class,()->service.create(input));
        verifyNoInteractions(jdbc);
    }
    @Test void rejectsInvalidFinancialLimitsBeforeWriting() {
        var input=new InsurancePlanService.Write("Test","PPO",LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),1500,100,25,50,75,plan.coverage());
        assertThrows(ResponseStatusException.class,()->service.create(input));
        verifyNoInteractions(jdbc);
    }
}
