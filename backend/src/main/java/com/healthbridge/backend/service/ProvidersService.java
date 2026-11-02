package com.healthbridge.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProvidersService {

    private final JdbcTemplate jdbc;

    public ProvidersService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> getProviders() {
        return jdbc.queryForList("""
            SELECT
                id,
                name,
                specialty,
                facility,
                city,
                state,
                network_status AS "networkStatus",
                accepting_patients AS "acceptingPatients",
                phone,
                address
            FROM providers
            ORDER BY id
            """);
    }
}
