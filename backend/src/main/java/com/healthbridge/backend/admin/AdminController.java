package com.healthbridge.backend.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import static com.healthbridge.backend.admin.AdminModels.*;

@RestController
@RequestMapping("/api/v1/admin")
@Validated
public class AdminController {
    private final AdminMemberService members;
    public AdminController(AdminMemberService members) { this.members = members; }

    @GetMapping("/plans") public java.util.List<InsurancePlanService.Plan> plans() { return members.plans(); }

    @GetMapping("/dashboard") public Dashboard dashboard() { return members.dashboard(); }

    @GetMapping("/members")
    public MemberPage list(@RequestParam(defaultValue="") @Size(max=150) String search,
            @RequestParam(defaultValue="") @Pattern(regexp="|Active|Inactive") String coverage,
            @RequestParam(defaultValue="") @Pattern(regexp="|enabled|disabled|pending|missing") String account,
            @RequestParam(defaultValue="0") @Min(0) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue="newest") @Pattern(regexp="newest|oldest|name-asc|name-desc|plan-asc") String sort) {
        return members.list(search, coverage, account, page, size, sort);
    }

    @GetMapping("/members/{id}") public MemberDetails details(@PathVariable @Size(max=30) String id) { return members.details(id); }
    @PostMapping("/members") @ResponseStatus(HttpStatus.CREATED)
    public Registration register(@Valid @RequestBody MemberWrite input) { return members.register(input); }
    @PatchMapping("/members/{id}")
    public MemberDetails update(@PathVariable @Size(max=30) String id, @Valid @RequestBody MemberWrite input) { return members.update(id, input); }
    @PatchMapping("/members/{id}/account")
    public MemberDetails account(@PathVariable @Size(max=30) String id, @Valid @RequestBody AccountUpdate input) { return members.account(id, input); }
    @PostMapping("/members/{id}/password-setup")
    public Registration reissue(@PathVariable @Size(max=30) String id, @Valid @RequestBody VersionRequest input) { return members.reissue(id, input); }
}
