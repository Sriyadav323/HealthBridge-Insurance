package com.healthbridge.backend.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/claims")
@Validated
public class AdminClaimsController {
    private final AdminClaimsService claims;
    public AdminClaimsController(AdminClaimsService claims) { this.claims=claims; }
    @GetMapping public AdminClaimsService.Page list(@RequestParam(defaultValue="") @Size(max=150) String search,
        @RequestParam(defaultValue="") @Pattern(regexp="|Pending|Approved|Denied") String status,
        @RequestParam(defaultValue="0") @Min(0) @Max(1000000) int page,@RequestParam(defaultValue="25") @Min(1) @Max(100) int size) {
        return claims.list(search,status,page,size);
    }
    @GetMapping("/member-coverage") public Map<String,Object> coverage(@RequestParam @Size(max=30) String memberId) { return claims.coverage(memberId); }
    @GetMapping("/{id}") public Map<String,Object> detail(@PathVariable @Size(max=40) String id) { return claims.detail(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> create(@Valid @RequestBody AdminClaimsService.Create input) { return claims.create(input); }
    @PostMapping("/{id}/coverage") public Map<String,Object> confirmCoverage(@PathVariable @Size(max=40) String id,
        @Valid @RequestBody AdminClaimsService.CoverageReview input,org.springframework.security.core.Authentication authentication) {
        return claims.confirmCoverage(id,input,authentication.getName());
    }
    @PatchMapping("/{id}") public Map<String,Object> review(@PathVariable @Size(max=40) String id,@Valid @RequestBody AdminClaimsService.Review input,org.springframework.security.core.Authentication authentication) { return claims.review(id,input,authentication.getName()); }
}
