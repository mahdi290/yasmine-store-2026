# Stage 1: Build Spring Boot backend
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B
COPY backend/src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Production Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENV PORT=8081
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
