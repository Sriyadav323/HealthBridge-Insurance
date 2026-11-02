package com.healthbridge.backend.api;
import com.healthbridge.backend.service.ProvidersService;
import com.healthbridge.backend.service.BenefitsService;

import com.healthbridge.backend.service.ClaimsService;


import java.util.List;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class PortalController {

    private final BenefitsService benefitsService;
    private final ProvidersService providersService;



    private final ClaimsService claimsService;

    public PortalController(ClaimsService claimsService, BenefitsService benefitsService, ProvidersService providersService) {

        this.benefitsService = benefitsService;
        this.providersService = providersService;

        this.claimsService = claimsService;
    }



    @GetMapping("/members/me/benefits")
    public Map<String, Object> benefits(Authentication authentication) {
        return benefitsService.getBenefits(authentication.getName());
    }

    private Map<String, Object> coverage(
        String id, String name, String category,
        String status, String cost, String notes
    ) {
        return Map.of(
            "id", id,
            "name", name,
            "category", category,
            "status", status,
            "cost", cost,
            "notes", notes
        );
    }

    @GetMapping("/members/me/claims")
    public List<Map<String, Object>> claims(Authentication authentication) {
        return claimsService.getClaims(authentication.getName());
    }

    @GetMapping("/providers")
    public List<Map<String, Object>> providers() {
        return providersService.getProviders();
    }

    private Map<String, Object> provider(
        String id, String name, String specialty,
        String facility, String city, String state,
        String networkStatus, boolean acceptingPatients,
        String phone, String address
    ) {
        return Map.of(
            "id", id,
            "name", name,
            "specialty", specialty,
            "facility", facility,
            "city", city,
            "state", state,
            "networkStatus", networkStatus,
            "acceptingPatients", acceptingPatients,
            "phone", phone,
            "address", address
        );
    }
}
