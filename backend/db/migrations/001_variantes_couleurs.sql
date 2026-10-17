-- =====================================================================
-- Migration 001 : produits multicolores (variantes couleur)
-- =====================================================================
-- Le backend tourne avec spring.jpa.hibernate.ddl-auto=update : ces tables
-- et colonnes sont créées AUTOMATIQUEMENT au démarrage. Ce script sert de
-- référence, ou à appliquer à la main si ddl-auto est un jour désactivé.
--
-- Rétrocompatibilité : les produits existants n'ont aucune ligne dans
-- product_variants et continuent d'être gérés par taille (product_size_stocks).
-- Aucune donnée existante n'est modifiée.
-- =====================================================================

SET NAMES utf8mb4;

-- Couleurs d'un produit (nom, pastille, photos une URL par ligne, ordre d'affichage)
CREATE TABLE IF NOT EXISTS product_variants (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  product_id  BIGINT       NOT NULL,
  color_name  VARCHAR(255) NOT NULL,
  color_hex   VARCHAR(20)  DEFAULT NULL,
  images      LONGTEXT     DEFAULT NULL,
  position    INT          DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_product_variants_product (product_id),
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock par couleur et par taille
CREATE TABLE IF NOT EXISTS product_variant_size_stocks (
  variant_id  BIGINT       NOT NULL,
  size        VARCHAR(255) NOT NULL,
  stock       INT          DEFAULT NULL,
  PRIMARY KEY (variant_id, size),
  CONSTRAINT fk_variant_size_stocks_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Couleur choisie, conservée sur chaque ligne de commande (instantané, sans clé étrangère
-- pour que la commande reste lisible même si la couleur est supprimée ensuite).
-- La colonne order_items.color existait déjà ("Default" pour les anciennes commandes).
ALTER TABLE order_items ADD COLUMN variant_id BIGINT      DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN color_hex  VARCHAR(20) DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN image_url  LONGTEXT    DEFAULT NULL;

-- Panier serveur (utilisateurs connectés) : couleur choisie
ALTER TABLE cart_items ADD COLUMN variant_id BIGINT DEFAULT NULL;

-- ---------------------------------------------------------------------
-- Exemple (optionnel) : transformer un produit existant en produit multicolore.
-- Remplacer 42 par l'id du produit. Le stock du produit devient la somme des couleurs
-- dès la prochaine modification dans l'admin (ou de la prochaine commande).
-- ---------------------------------------------------------------------
-- INSERT INTO product_variants (product_id, color_name, color_hex, images, position)
--   VALUES (42, 'Blanc', '#F5F0E6', 'https://.../pull-blanc.jpg', 0),
--          (42, 'Rouge', '#8B1E2D', 'https://.../pull-rouge.jpg', 1);
-- INSERT INTO product_variant_size_stocks (variant_id, size, stock)
--   SELECT id, 'M', 5 FROM product_variants WHERE product_id = 42;
