package com.ecommerce.backend.service;

import com.ecommerce.backend.model.Order;
import com.ecommerce.backend.model.OrderItem;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.store.notification-email:yasminestoresf@gmail.com}")
    private String storeNotificationEmail;

    @Value("${spring.mail.username:yasminestoresf@gmail.com}")
    private String mailSenderUsername;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /**
     * Envoie de manière asynchrone un email récapitulatif de la commande à la boutique
     * et au client (si une adresse email a été fournie).
     */
    public void sendOrderNotificationAsync(Order order, List<OrderItem> items) {
        CompletableFuture.runAsync(() -> {
            try {
                sendOrderNotification(order, items);
            } catch (Exception e) {
                log.error("Erreur lors de l'envoi de l'email de commande #{}: {}", order.getId(), e.getMessage());
            }
        });
    }

    public void sendOrderNotification(Order order, List<OrderItem> items) {
        String formattedDate = order.getCreatedAt() != null ? order.getCreatedAt().format(DATE_FORMATTER) : "Récemment";
        String htmlContent = buildOrderEmailHtml(order, items, formattedDate);
        String subject = "🛍️ [Yasmina Store] Nouvelle Commande #" + order.getId() + " - " + order.getCustomerName() + " (" + order.getTotalPrice() + " DT)";

        // 1. Toujours afficher un récapitulatif complet dans la console
        logOrderSummaryToConsole(order, items, formattedDate);

        // 2. Si JavaMailSender n'est pas disponible
        if (mailSender == null) {
            log.warn("JavaMailSender n'est pas initialisé. Vérifiez les paramètres spring.mail dans application.properties.");
            return;
        }

        // 3. Envoyer l'email au gérant du magasin (yasminestoresf@gmail.com)
        try {
            sendHtmlEmail(storeNotificationEmail, subject, htmlContent);
            log.info("Email de notification de commande #{} envoyé avec succès à {}", order.getId(), storeNotificationEmail);
        } catch (Exception e) {
            log.warn("Échec d'envoi de l'email à la boutique ({}): {}. (Note: Si vous utilisez Gmail, vous devez générer un 'Mot de passe d'application' Google de 16 caractères).", storeNotificationEmail, e.getMessage());
        }

        // 4. Si le client a renseigné son email, lui envoyer également un accusé de réception
        if (order.getEmail() != null && !order.getEmail().trim().isEmpty() && !order.getEmail().equalsIgnoreCase(storeNotificationEmail)) {
            try {
                String customerSubject = "Confirmation de votre commande #" + order.getId() + " - Yasmina Store";
                sendHtmlEmail(order.getEmail().trim(), customerSubject, htmlContent);
                log.info("Email de confirmation client envoyé à {}", order.getEmail());
            } catch (Exception e) {
                log.warn("Échec d'envoi de l'email client ({}): {}", order.getEmail(), e.getMessage());
            }
        }
    }

    private void sendHtmlEmail(String to, String subject, String htmlContent) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(mailSenderUsername, "Yasmina Store");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        mailSender.send(message);
    }

    private String buildOrderEmailHtml(Order order, List<OrderItem> items, String formattedDate) {
        StringBuilder itemsHtml = new StringBuilder();

        for (OrderItem item : items) {
            String prodName = item.getProduct() != null ? item.getProduct().getName() : "Article #" + item.getId();
            String prodImg = item.getProduct() != null && item.getProduct().getImageUrl() != null ? item.getProduct().getImageUrl() : "";
            String size = item.getSize() != null ? item.getSize() : "M";
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            String unitPrice = item.getPrice() != null ? item.getPrice().toString() : "0.00";
            String subtotal = item.getPrice() != null ? item.getPrice().multiply(java.math.BigDecimal.valueOf(qty)).toString() : unitPrice;

            String imgTd = !prodImg.isEmpty() 
                ? "<td style=\"width: 55px; padding-right: 10px;\"><img src=\"" + prodImg + "\" alt=\"photo\" style=\"width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #eee;\" /></td>" 
                : "";

            itemsHtml.append("<tr style=\"border-bottom: 1px solid #e5e7eb;\">")
                .append("<td style=\"padding: 12px; vertical-align: middle;\">")
                .append("<table style=\"width: 100%; border-collapse: collapse;\">")
                .append("<tr>")
                .append(imgTd)
                .append("<td style=\"vertical-align: middle;\">")
                .append("<strong style=\"color: #111827; font-size: 14px;\">").append(prodName).append("</strong>")
                .append("<div style=\"color: #6b7280; font-size: 12px; margin-top: 2px;\">Taille : <span style=\"background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #111;\">").append(size).append("</span></div>")
                .append("</td>")
                .append("</tr>")
                .append("</table>")
                .append("</td>")
                .append("<td style=\"padding: 12px; text-align: center; color: #374151; font-weight: bold;\">").append(qty).append("</td>")
                .append("<td style=\"padding: 12px; text-align: right; color: #374151;\">").append(unitPrice).append(" DT</td>")
                .append("<td style=\"padding: 12px; text-align: right; color: #111827; font-weight: bold;\">").append(subtotal).append(" DT</td>")
                .append("</tr>");
        }

        String customerEmail = order.getEmail() != null && !order.getEmail().trim().isEmpty() ? order.getEmail() : "Non renseigné";
        String customerPhone = order.getPhone() != null && !order.getPhone().trim().isEmpty() ? order.getPhone() : "Non renseigné";
        String customerAddress = order.getAddress() != null && !order.getAddress().trim().isEmpty() ? order.getAddress() : "Non renseignée";
        String customerCity = order.getCity() != null && !order.getCity().trim().isEmpty() ? order.getCity() : "Tunisie";

        return "<!DOCTYPE html>"
            + "<html>"
            + "<head><meta charset=\"UTF-8\"><title>Nouvelle Commande - Yasmina Store</title></head>"
            + "<body style=\"margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937;\">"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color: #f8fafc; padding: 30px 10px;\">"
            + "<tr><td align=\"center\">"
            + "<table width=\"600\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;\">"
            + "<tr><td style=\"background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center; color: #ffffff;\">"
            + "<h1 style=\"margin: 0; font-size: 26px; letter-spacing: 1px; font-weight: 800; text-transform: uppercase;\">YASMINA STORE</h1>"
            + "<p style=\"margin: 8px 0 0; font-size: 14px; color: #94a3b8;\">Notification de Nouvelle Commande</p>"
            + "</td></tr>"
            + "<tr><td style=\"padding: 24px 30px 10px;\">"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\">"
            + "<tr><td>"
            + "<span style=\"background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: bold; letter-spacing: 1px; padding: 6px 12px; border-radius: 50px; text-transform: uppercase;\">Commande Validée</span>"
            + "<h2 style=\"margin: 12px 0 4px; font-size: 20px; color: #0f172a;\">Commande #" + order.getId() + "</h2>"
            + "<p style=\"margin: 0; font-size: 13px; color: #64748b;\">Passée le " + formattedDate + "</p>"
            + "</td><td align=\"right\" style=\"vertical-align: top;\">"
            + "<div style=\"font-size: 12px; color: #64748b;\">Total Commande</div>"
            + "<div style=\"font-size: 24px; font-weight: 800; color: #0f172a;\">" + order.getTotalPrice() + " DT</div>"
            + "</td></tr></table></td></tr>"
            + "<tr><td style=\"padding: 10px 30px 20px;\">"
            + "<div style=\"background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px;\">"
            + "<h3 style=\"margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;\">Coordonnées du Client</h3>"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"4\" style=\"font-size: 13px;\">"
            + "<tr><td style=\"color: #64748b; width: 120px;\">Nom & Prénom :</td><td><strong style=\"color: #0f172a;\">" + order.getCustomerName() + "</strong></td></tr>"
            + "<tr><td style=\"color: #64748b;\">Téléphone :</td><td><a href=\"tel:" + customerPhone + "\" style=\"color: #2563eb; text-decoration: none; font-weight: bold;\">" + customerPhone + "</a></td></tr>"
            + "<tr><td style=\"color: #64748b;\">Email :</td><td><a href=\"mailto:" + customerEmail + "\" style=\"color: #2563eb; text-decoration: none;\">" + customerEmail + "</a></td></tr>"
            + "<tr><td style=\"color: #64748b;\">Adresse :</td><td style=\"color: #0f172a;\">" + customerAddress + ", " + customerCity + "</td></tr>"
            + "<tr><td style=\"color: #64748b;\">Paiement :</td><td><span style=\"background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #1e293b;\">Paiement à la livraison</span></td></tr>"
            + "</table></div></td></tr>"
            + "<tr><td style=\"padding: 10px 30px;\">"
            + "<h3 style=\"margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;\">Articles Commandés</h3>"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse: collapse; font-size: 13px;\">"
            + "<thead><tr style=\"background-color: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;\">"
            + "<th style=\"padding: 10px 12px; text-align: left; border-radius: 6px 0 0 6px;\">Article</th>"
            + "<th style=\"padding: 10px 12px; text-align: center;\">Qté</th>"
            + "<th style=\"padding: 10px 12px; text-align: right;\">Prix Unitaire</th>"
            + "<th style=\"padding: 10px 12px; text-align: right; border-radius: 0 6px 6px 0;\">Total</th>"
            + "</tr></thead><tbody>"
            + itemsHtml.toString()
            + "</tbody></table></td></tr>"
            + "<tr><td style=\"padding: 20px 30px;\">"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"6\" style=\"font-size: 14px;\">"
            + "<tr><td align=\"right\" style=\"color: #64748b;\">Sous-total :</td><td align=\"right\" style=\"width: 120px; color: #0f172a; font-weight: 600;\">" + order.getTotalPrice() + " DT</td></tr>"
            + "<tr><td align=\"right\" style=\"color: #64748b;\">Livraison Express :</td><td align=\"right\" style=\"color: #10b981; font-weight: 600;\">Inclus / À confirmer</td></tr>"
            + "<tr style=\"border-top: 2px solid #e2e8f0;\">"
            + "<td align=\"right\" style=\"font-size: 16px; font-weight: bold; color: #0f172a; padding-top: 12px;\">Total à encaisser :</td>"
            + "<td align=\"right\" style=\"font-size: 20px; font-weight: 800; color: #0f172a; padding-top: 12px;\">" + order.getTotalPrice() + " DT</td>"
            + "</tr></table></td></tr>"
            + "<tr><td align=\"center\" style=\"padding: 10px 30px 30px;\">"
            + "<a href=\"http://localhost:4200/admin/orders\" style=\"display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; letter-spacing: 0.5px; padding: 12px 28px; border-radius: 8px; text-transform: uppercase;\">"
            + "Gérer la commande dans l'Admin &rarr;"
            + "</a></td></tr>"
            + "<tr><td style=\"background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;\">"
            + "<p style=\"margin: 0;\">Yasmina Store • Prêt-à-porter & Mode Féminine en Tunisie</p>"
            + "<p style=\"margin: 4px 0 0;\">Cet email automatique a été généré suite à la passation d'une commande.</p>"
            + "</td></tr></table></td></tr></table></body></html>";
    }

    private void logOrderSummaryToConsole(Order order, List<OrderItem> items, String formattedDate) {
        System.out.println("================================================================================");
        System.out.println("🔔 NOUVELLE COMMANDE REÇUE -> NOTIFICATION POUR : " + storeNotificationEmail);
        System.out.println("================================================================================");
        System.out.println("Commande N°  : #" + order.getId());
        System.out.println("Date         : " + formattedDate);
        System.out.println("Client       : " + order.getCustomerName());
        System.out.println("Téléphone    : " + order.getPhone());
        System.out.println("Email        : " + (order.getEmail() != null ? order.getEmail() : "N/A"));
        System.out.println("Adresse      : " + order.getAddress() + ", " + order.getCity());
        System.out.println("Total        : " + order.getTotalPrice() + " DT (Paiement à la livraison)");
        System.out.println("--------------------------------------------------------------------------------");
        System.out.println("Articles :");
        for (OrderItem item : items) {
            String name = item.getProduct() != null ? item.getProduct().getName() : "ID #" + item.getId();
            System.out.printf("  - %s | Taille: %s | Qté: %d | Prix: %s DT%n", name, item.getSize(), item.getQuantity(), item.getPrice());
        }
        System.out.println("================================================================================");
    }
}
