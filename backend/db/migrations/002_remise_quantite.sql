-- =====================================================================
-- Migration 002 : remise par quantité (configurable dans l'admin)
-- =====================================================================
-- Créé automatiquement par Hibernate (ddl-auto=update) au démarrage ;
-- script fourni comme référence / application manuelle.
-- Les anciennes commandes gardent subtotal / discount_* à NULL (= pas de remise).
-- =====================================================================

SET NAMES utf8mb4;

-- Règles de remise : "Achetez <min_quantity>, économisez <percent>%"
-- scope : ALL_PRODUCTS (chaque produit, couleurs additionnées), CART (tout le panier),
--         CATEGORY (category_id), PRODUCT (product_id)
CREATE TABLE IF NOT EXISTS quantity_discount_rules (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  label         VARCHAR(255) DEFAULT NULL,
  min_quantity  INT          NOT NULL,
  percent       INT          NOT NULL,
  active        BIT(1)       DEFAULT NULL,
  scope         VARCHAR(20)  NOT NULL,
  category_id   BIGINT       DEFAULT NULL,
  product_id    BIGINT       DEFAULT NULL,
  created_at    DATETIME(6)  DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Détail de la remise enregistré sur la commande
ALTER TABLE orders ADD COLUMN subtotal         DECIMAL(38,2) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN discount_amount  DECIMAL(38,2) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN discount_details TEXT          DEFAULT NULL;

ALTER TABLE order_items ADD COLUMN discount_percent INT           DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN discount_amount  DECIMAL(38,2) DEFAULT NULL;

-- Exemple (désactivé par défaut) : "Achetez 2, économisez 10%" sur une catégorie "Pulls"
-- INSERT INTO quantity_discount_rules (label, min_quantity, percent, active, scope, category_id, created_at)
--   SELECT NULL, 2, 10, b'0', 'CATEGORY', id, NOW(6) FROM categories WHERE name = 'Pulls' LIMIT 1;
