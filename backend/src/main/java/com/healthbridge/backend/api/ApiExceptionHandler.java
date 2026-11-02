package com.healthbridge.backend.api;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(EmptyResultDataAccessException.class)
    ResponseEntity<Map<String, String>> notFound() {
        return error(404, "NOT_FOUND", "The requested member record was not found.");
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Map<String, String>> duplicate() {
        return error(409, "CONFLICT", "An account already uses that email, or the record conflicts with an existing account.");
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> databaseUnavailable() {
        // Never send SQL, connection details, or bound member values to the browser.
        return error(503, "SERVICE_UNAVAILABLE", "Member information is temporarily unavailable.");
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, jakarta.validation.ConstraintViolationException.class,
        org.springframework.web.method.annotation.HandlerMethodValidationException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, String>> invalidInput() {
        return error(400, "INVALID_INPUT", "Please check the submitted information.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> requestError(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), "REQUEST_FAILED",
            exception.getReason() == null ? "Request failed." : exception.getReason());
    }

    private ResponseEntity<Map<String, String>> error(int status, String code, String message) {
        return ResponseEntity.status(status).header("Cache-Control", "no-store")
            .body(Map.of("code", code, "message", message));
    }
}
