-- =====================================================================
-- Migration 003 : pourcentage de remise avec décimales
-- =====================================================================
-- Permet des offres du type "1 haut : 30 DT, 2 hauts : 50 DT" (= 16.67 %).
-- Appliquée AUTOMATIQUEMENT au démarrage par config/SchemaMigrations.java
-- (ddl-auto=update ne modifie pas le type d'une colonne existante).
-- Script fourni comme référence ; sans effet sur les valeurs existantes (10 -> 10.00).
-- =====================================================================

ALTER TABLE quantity_discount_rules MODIFY percent DECIMAL(5,2) NOT NULL;
ALTER TABLE order_items MODIFY discount_percent DECIMAL(5,2) NULL;
