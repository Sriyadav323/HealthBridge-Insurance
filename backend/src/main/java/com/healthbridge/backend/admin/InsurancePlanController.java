package com.healthbridge.backend.admin;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/insurance-plans")
public class InsurancePlanController {
    private final InsurancePlanService plans;
    public InsurancePlanController(InsurancePlanService plans) { this.plans=plans; }
    @GetMapping public List<InsurancePlanService.Plan> list() { return plans.list(false); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public InsurancePlanService.Plan create(@Valid @RequestBody InsurancePlanService.Write input) {
        try { return plans.create(input); }
        catch (org.springframework.dao.DuplicateKeyException duplicate) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,
                "A version of this plan already starts on that date. Choose a different effective start date.");
        }
    }
    @PostMapping("/{id}/retire") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retire(@PathVariable long id) { plans.retire(id); }
}
