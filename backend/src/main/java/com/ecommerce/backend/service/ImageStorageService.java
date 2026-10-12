package com.ecommerce.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Enregistre les images uploadées depuis l'admin.
 * Sur Render, le disque est effacé à chaque déploiement : les images sont donc envoyées
 * sur Cloudinary (variable CLOUDINARY_URL). Sans cette variable (en local), elles sont
 * enregistrées dans le dossier uploads/.
 */
@Service
@Slf4j
public class ImageStorageService {

    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;
    private final RestClient restClient;

    // Format fourni par Cloudinary : cloudinary://<api_key>:<api_secret>@<cloud_name>
    public ImageStorageService(@Value("${app.cloudinary.url:}") String cloudinaryUrl) {
        String url = cloudinaryUrl.trim();
        if (url.startsWith("cloudinary://") && url.contains("@") && url.contains(":")) {
            String credentials = url.substring("cloudinary://".length(), url.lastIndexOf('@'));
            this.apiKey = credentials.substring(0, credentials.indexOf(':'));
            this.apiSecret = credentials.substring(credentials.indexOf(':') + 1);
            this.cloudName = url.substring(url.lastIndexOf('@') + 1);
            log.info(">>> Images stockées sur Cloudinary (cloud : {})", cloudName);
        } else {
            this.apiKey = null;
            this.apiSecret = null;
            this.cloudName = null;
            log.warn(">>> CLOUDINARY_URL absent : images stockées sur le disque local (effacées à chaque déploiement Render)");
        }
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10_000);
        requestFactory.setReadTimeout(60_000);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * @param folder sous-dossier, par exemple "products" ou "carousel"
     * @return l'URL publique de l'image
     */
    public String store(MultipartFile file, String folder) throws IOException {
        return cloudName != null ? uploadToCloudinary(file, folder) : storeLocally(file, folder);
    }

    private String uploadToCloudinary(MultipartFile file, String folder) throws IOException {
        String cloudFolder = "yasmine-store/" + folder;
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        String signature = sha1Hex("folder=" + cloudFolder + "&timestamp=" + timestamp + apiSecret);
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image";

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        body.add("api_key", apiKey);
        body.add("timestamp", timestamp);
        body.add("folder", cloudFolder);
        body.add("signature", signature);

        Map<?, ?> response = restClient.post()
                .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(Map.class);

        if (response == null || response.get("secure_url") == null) {
            throw new IOException("Réponse Cloudinary invalide");
        }
        return (String) response.get("secure_url");
    }

    private String storeLocally(MultipartFile file, String folder) throws IOException {
        String uploadDir = "uploads/" + folder + "/";
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String newFilename = UUID.randomUUID().toString() + extension;
        Path filePath = Paths.get(uploadDir + newFilename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/" + folder + "/" + newFilename)
                .toUriString();
    }

    private static String sha1Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
