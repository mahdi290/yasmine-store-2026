# Migrations base de données

Le backend utilise `spring.jpa.hibernate.ddl-auto=update` : **au démarrage, Hibernate crée
automatiquement les nouvelles tables et colonnes**. Rien à exécuter à la main lors d'un
déploiement normal sur Render.

Les scripts ci-dessous servent de référence (ou à appliquer manuellement si `ddl-auto`
est un jour désactivé). Ils sont écrits pour MySQL 8 / MariaDB et sont à exécuter dans l'ordre,
une seule fois :

| Script | Contenu |
| --- | --- |
| `001_variantes_couleurs.sql` | Tables `product_variants` et `product_variant_size_stocks`, colonnes couleur sur `order_items` et `cart_items` |
| `002_remise_quantite.sql` | Table `quantity_discount_rules`, colonnes de remise sur `orders` et `order_items` |

Aucune donnée existante n'est modifiée :

- les produits existants restent « sans couleur » et gardent leur stock par taille ;
- les anciennes commandes gardent `color = 'Default'` et des colonnes de remise à `NULL`
  (affichées comme « sans remise ») ;
- le nouveau statut de commande `CONFIRMED` (Confirmée) est une simple valeur texte de
  la colonne `orders.status`, sans migration.
