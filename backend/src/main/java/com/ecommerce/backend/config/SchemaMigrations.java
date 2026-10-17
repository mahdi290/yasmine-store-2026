package com.ecommerce.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Petites migrations de schéma que ddl-auto=update ne sait pas faire :
 * Hibernate ajoute les colonnes manquantes mais ne change jamais le type d'une colonne existante.
 * Chaque étape vérifie l'état actuel avant d'agir (idempotent). Voir backend/db/migrations/.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SchemaMigrations implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        // 003 : pourcentages de remise décimaux (ex. 16.67 % pour "2 hauts à 50 DT au lieu de 60 DT")
        convertToDecimal("quantity_discount_rules", "percent", "DECIMAL(5,2) NOT NULL");
        convertToDecimal("order_items", "discount_percent", "DECIMAL(5,2) NULL");
    }

    private void convertToDecimal(String table, String column, String definition) {
        try {
            List<String> types = jdbc.queryForList(
                    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                    String.class, table, column);
            if (types.isEmpty() || "decimal".equalsIgnoreCase(types.get(0))) {
                return;
            }
            jdbc.execute("ALTER TABLE " + table + " MODIFY " + column + " " + definition);
            log.info("Migration : {}.{} converti en {}", table, column, definition);
        } catch (Exception e) {
            log.error("Migration de {}.{} impossible : {}", table, column, e.getMessage());
        }
    }
}
