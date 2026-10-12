package com.ecommerce.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Empêche l'instance gratuite Render de se mettre en veille (après 15 min sans trafic)
 * en appelant 2 endpoints publics de l'API toutes les 8 minutes via l'URL publique.
 * Render fournit automatiquement RENDER_EXTERNAL_URL ; en local la variable est vide
 * et aucun appel n'est fait.
 */
@Component
@Slf4j
public class KeepAliveScheduler {

    private static final List<String> ENDPOINTS = List.of("/api/categories", "/api/departments");

    private final String baseUrl;
    private final RestClient restClient;

    public KeepAliveScheduler(@Value("${app.keep-alive.url:${RENDER_EXTERNAL_URL:}}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10_000);
        requestFactory.setReadTimeout(30_000);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    @Scheduled(initialDelay = 60_000, fixedRate = 8 * 60 * 1000)
    public void ping() {
        if (baseUrl.isBlank()) {
            return;
        }
        for (String endpoint : ENDPOINTS) {
            try {
                restClient.get()
                        .uri(baseUrl + endpoint)
                        .retrieve()
                        .toBodilessEntity();
                log.info(">>> Keep-alive OK : {}", endpoint);
            } catch (Exception e) {
                log.warn(">>> Keep-alive échoué pour {} : {}", endpoint, e.getMessage());
            }
        }
    }
}
