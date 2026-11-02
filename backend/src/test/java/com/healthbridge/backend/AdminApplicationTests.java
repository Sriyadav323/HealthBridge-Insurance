package com.healthbridge.backend;

import com.healthbridge.backend.admin.AdminMemberService;
import com.healthbridge.backend.admin.PasswordSetupService;
import com.healthbridge.backend.admin.AdminModels.*;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration")
@AutoConfigureMockMvc
class AdminApplicationTests {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder passwords;
    @MockitoBean JdbcTemplate jdbc;
    @MockitoBean AdminMemberService members;
    @MockitoBean PasswordSetupService setup;
    @MockitoBean com.healthbridge.backend.admin.AdminClaimsService claims;
    private final String body = """
        {"fullName":"Synthetic Member","email":"new@example.com","phone":"555-0101","address":"Demo address",
        "planName":"Demo PPO","planType":"PPO","coverageStatus":"Active","role":"ADMIN","version":0}
        """;
    private MemberDetails details;

    @BeforeEach
    void access() {
        when(jdbc.queryForList(contains("SELECT a.enabled, a.session_version"), anyString())).thenAnswer(invocation -> {
            String id = invocation.getArgument(1);
            return List.of(Map.of("enabled", true, "session_version", 0L, "role_name", id.equals("ADMIN-ID") ? "ADMIN" : "MEMBER"));
        });
        details = new MemberDetails(new MemberSummary("NEW-ID", "Synthetic Member", "new@example.com", "555-0101",
            "Demo PPO", "PPO", "Active", false, true, Instant.now().toString(), 0), "Demo address");
    }

    private MockHttpSession session(String role) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(role + "-ID", null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        return JsonPath.read(mvc.perform(get("/api/v1/auth/csrf").session(session)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(), "$.token");
    }

    @ParameterizedTest @ValueSource(strings={"/dashboard", "/plans", "/insurance-plans", "/claims", "/claims/CLM1001", "/members", "/members/NEW-ID"})
    void unauthenticatedAdminReadsReturn401(String path) throws Exception {
        mvc.perform(get("/api/v1/admin" + path)).andExpect(status().isUnauthorized());
        verifyNoInteractions(members);
    }

    @ParameterizedTest @ValueSource(strings={"/dashboard", "/plans", "/insurance-plans", "/claims", "/claims/CLM1001", "/members", "/members/NEW-ID"})
    void membersCannotReadAdminApis(String path) throws Exception {
        mvc.perform(get("/api/v1/admin" + path).session(session("MEMBER"))).andExpect(status().isForbidden());
        verifyNoInteractions(members);
    }

    @Test void membersCannotWriteAdminApisEvenWithCsrf() throws Exception {
        var session = session("MEMBER");
        String token = csrf(session);
        mvc.perform(post("/api/v1/admin/members").session(session).header("X-XSRF-TOKEN",token)
            .contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/admin/members/NEW-ID/account").session(session).header("X-XSRF-TOKEN",token)
            .contentType("application/json").content("{\"enabled\":true,\"version\":0}")).andExpect(status().isForbidden());
        verifyNoInteractions(members);
    }

    @Test void adminLoginLoadsDatabaseAuthoritiesAndCannotEnterMemberSelfService() throws Exception {
        String password = UUID.randomUUID().toString();
        when(jdbc.queryForList(contains("SELECT member_id, password_hash"), eq("admin@example.com")))
            .thenReturn(List.of(Map.of("member_id","ADMIN-ID","password_hash",passwords.encode(password),"session_version",0L)));
        when(jdbc.queryForList(contains("SELECT role_name FROM account_roles"),eq(String.class),eq("ADMIN-ID"))).thenReturn(List.of("ADMIN"));
        var session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login").session(session).header("X-XSRF-TOKEN",csrf(session))
            .contentType("application/json").content("{\"email\":\"admin@example.com\",\"password\":\""+password+"\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("ADMIN"))
            .andExpect(jsonPath("$.password_hash").doesNotExist());
        when(members.dashboard()).thenReturn(new Dashboard(5,4,1,3,List.of()));
        mvc.perform(get("/api/v1/admin/dashboard").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.totalMembers").value(5));
        mvc.perform(get("/api/v1/members/me/benefits").session(session)).andExpect(status().isForbidden());
    }

    @Test void adminRegistrationIsCreatedAndDoesNotAcceptARoleField() throws Exception {
        when(members.register(any())).thenReturn(new Registration(details,"A".repeat(43),Instant.now().plusSeconds(1800)));
        var session = session("ADMIN");
        var response = mvc.perform(post("/api/v1/admin/members").session(session).header("X-XSRF-TOKEN",csrf(session))
            .contentType("application/json").content(body)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.details.summary.passwordSetupRequired").value(true))
            .andExpect(jsonPath("$.details.summary.accountEnabled").value(false)).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("password_hash"));
        verify(members).register(argThat(input -> input.email().equals("new@example.com")));
        assertTrue(java.util.Arrays.stream(MemberWrite.class.getRecordComponents()).noneMatch(field -> field.getName().equals("role")));
    }

    @Test void duplicateEmailReturnsConflictWithoutDatabaseDetails() throws Exception {
        when(members.register(any())).thenThrow(new DuplicateKeyException("sensitive SQL"));
        var session = session("ADMIN");
        var response = mvc.perform(post("/api/v1/admin/members").session(session).header("X-XSRF-TOKEN",csrf(session))
            .contentType("application/json").content(body)).andExpect(status().isConflict()).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("sensitive SQL"));
    }

    @Test void invalidRegistrationNeverCallsTheService() throws Exception {
        var session = session("ADMIN");
        mvc.perform(post("/api/v1/admin/members").session(session).header("X-XSRF-TOKEN",csrf(session))
            .contentType("application/json").content(body.replace("new@example.com","invalid-email"))).andExpect(status().isBadRequest());
        verifyNoInteractions(members);
    }

    @Test void listingPassesSearchFiltersAndPaginationToService() throws Exception {
        when(members.list("Synthetic","Active","enabled",2,25,"newest")).thenReturn(new MemberPage(List.of(),55,3,2,25));
        mvc.perform(get("/api/v1/admin/members").session(session("ADMIN")).param("search","Synthetic")
            .param("coverage","Active").param("account","enabled").param("page","2").param("size","25"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(55)).andExpect(jsonPath("$.page").value(2));
        verify(members).list("Synthetic","Active","enabled",2,25,"newest");
    }

    @ParameterizedTest @ValueSource(strings={"page=-1","size=101","page=invalid","coverage=Other","account=Other","sort=unsupported"})
    void invalidListingParametersReturn400(String parameter) throws Exception {
        mvc.perform(get("/api/v1/admin/members?"+parameter).session(session("ADMIN"))).andExpect(status().isBadRequest());
        verifyNoInteractions(members);
    }

    @Test void adminMutationsRequireCsrf() throws Exception {
        mvc.perform(post("/api/v1/admin/members").session(session("ADMIN")).contentType("application/json").content(body))
            .andExpect(status().isForbidden());
        verifyNoInteractions(members);
    }

    @Test void adminCanUpdateAndDeactivateAnAccount() throws Exception {
        when(members.update(eq("NEW-ID"),any())).thenReturn(details);
        when(members.account(eq("NEW-ID"),any())).thenReturn(details);
        var session = session("ADMIN");
        String token = csrf(session);
        mvc.perform(patch("/api/v1/admin/members/NEW-ID").session(session).header("X-XSRF-TOKEN",token)
            .contentType("application/json").content(body)).andExpect(status().isOk());
        mvc.perform(patch("/api/v1/admin/members/NEW-ID/account").session(session).header("X-XSRF-TOKEN",token)
            .contentType("application/json").content("{\"enabled\":false,\"version\":0}")).andExpect(status().isOk());
        verify(members).account("NEW-ID",new AccountUpdate(false,0L));
    }

    @Test void passwordSetupIsPublicButCsrfProtectedAndDoesNotSignTheUserIn() throws Exception {
        var session = new MockHttpSession();
        String content="{\"token\":\""+"A".repeat(43)+"\",\"password\":\""+UUID.randomUUID()+"\"}";
        mvc.perform(post("/api/v1/auth/password-setup").session(session).contentType("application/json").content(content))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/password-setup").session(session).header("X-XSRF-TOKEN",csrf(session))
            .contentType("application/json").content(content)).andExpect(status().isNoContent());
        verify(setup).complete(eq("A".repeat(43)),anyString());
        mvc.perform(get("/api/v1/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test void sensitiveSetupRecordsAreRedactedWhenRendered() {
        assertEquals("PasswordSetup[redacted]",new com.healthbridge.backend.admin.PasswordSetupController.PasswordSetup("secret", "password").toString());
        assertEquals("Registration[redacted]",new Registration(details,"secret",Instant.now()).toString());
    }
    @Test void adminCanReadExistingInsurancePlans() throws Exception {
        when(members.plans()).thenReturn(List.of(new com.healthbridge.backend.admin.InsurancePlanService.Plan(1L,"HealthBridge Gold PPO", "PPO",java.time.LocalDate.of(2026,1,1),java.time.LocalDate.of(2026,12,31),false,1500,5000,25,50,75,List.of())));
        mvc.perform(get("/api/v1/admin/plans").session(session("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].planName").value("HealthBridge Gold PPO"))
            .andExpect(jsonPath("$[0].planType").value("PPO"));
    }
    @Test void membersCannotPublishPlansEvenWithCsrf() throws Exception {
        var memberSession=session("MEMBER");
        mvc.perform(post("/api/v1/admin/insurance-plans").session(memberSession)
            .header("X-XSRF-TOKEN",csrf(memberSession)).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test void membersCannotCreateOrFinalizeClaims() throws Exception {
        var memberSession=session("MEMBER");
        String csrfValue=csrf(memberSession);
        mvc.perform(post("/api/v1/admin/claims").session(memberSession).header("X-XSRF-TOKEN",csrfValue)
            .contentType("application/json").content("{}" )).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/admin/claims/CLM1001").session(memberSession).header("X-XSRF-TOKEN",csrfValue)
            .contentType("application/json").content("{}" )).andExpect(status().isForbidden());
        verifyNoInteractions(claims);
    }
    @Test void claimMutationsRequireCsrfAndValidAmounts() throws Exception {
        var admin=session("ADMIN");
        mvc.perform(post("/api/v1/admin/claims").session(admin).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/admin/claims/CLM1001").session(admin).header("X-XSRF-TOKEN",csrf(admin))
            .contentType("application/json").content("{\"version\":0,\"status\":\"Approved\",\"allowedAmount\":-1}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(claims);
    }
    @Test void directorySortingUsesAnAllowedSortKey() throws Exception {
        when(members.list("","","",0,10,"name-asc")).thenReturn(new MemberPage(List.of(),0,0,0,10));
        mvc.perform(get("/api/v1/admin/members").param("sort","name-asc").session(session("ADMIN")))
            .andExpect(status().isOk());
        verify(members).list("","","",0,10,"name-asc");
    }
    @Test void membersCannotConfirmHistoricalClaimCoverage() throws Exception {
        var memberSession=session("MEMBER");
        mvc.perform(post("/api/v1/admin/claims/CLM1001/coverage").session(memberSession)
            .header("X-XSRF-TOKEN",csrf(memberSession)).contentType("application/json")
            .content("{\"version\":0,\"coverageItemId\":\"MC001\",\"confirmed\":true}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(claims);
    }
    @Test void historicalCoverageConfirmationRequiresAnExplicitAttestation() throws Exception {
        var admin=session("ADMIN");
        mvc.perform(post("/api/v1/admin/claims/CLM1001/coverage").session(admin)
            .header("X-XSRF-TOKEN",csrf(admin)).contentType("application/json")
            .content("{\"version\":0,\"coverageItemId\":\"MC001\",\"confirmed\":false}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(claims);
    }
}
