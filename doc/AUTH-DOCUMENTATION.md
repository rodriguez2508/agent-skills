# Sistema de Autenticación - Documentación

## 📋 Descripción General

El sistema de autenticación ha sido mejorado con las siguientes funcionalidades:

- ✅ **Registro con email y password** (hash con bcrypt)
- ✅ **Email verification** con tokens
- ✅ **Password reset** flow completo
- ✅ **Login con password** validado
- ✅ **Guards** para proteger rutas
- ✅ **Sessions** basadas en IP y sessionId

---

## 🔐 Endpoints Disponibles

### Registro y Login

#### 1. `POST /auth/register/password`
Registro de usuario con email y password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg",
  "sessionId": "session-123456"
}
```

**Respuesta:**
```json
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false
  },
  "session": {
    "id": "uuid",
    "sessionId": "session-123456",
    "status": "ACTIVE"
  }
}
```

---

#### 2. `POST /auth/login/password`
Login con email y password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "sessionId": "session-123456"
}
```

**Respuesta:**
```json
{
  "message": "User logged in successfully",
  "user": { ... },
  "session": { ... }
}
```

---

#### 3. `POST /auth/register` (existente)
Registro/login por IP (sin password).

---

#### 4. `POST /auth/login` (existente)
Login por email (sin password).

---

### Verificación de Email

#### 5. `POST /auth/verify-email`
Verifica el email con el token recibido.

**Body:**
```json
{
  "token": "abc123xyz..."
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### Password Reset

#### 6. `POST /auth/password/reset/request`
Solicita reset de password.

**Body:**
```json
{
  "email": "user@example.com",
  "frontendUrl": "http://localhost:3000"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

---

#### 7. `POST /auth/password/reset`
Resetea la password con el token.

**Body:**
```json
{
  "token": "abc123xyz...",
  "newPassword": "NewSecurePass123!"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### Rutas Protegidas

#### 8. `POST /auth/password/change` ⚠️
Cambia la password (requiere autenticación).

**Headers:**
```
x-session-id: session-123456
```

**Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!"
}
```

---

#### 9. `GET /auth/me` ⚠️
Obtiene información del usuario autenticado.

**Headers:**
```
x-session-id: session-123456
```

**Respuesta:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "active": true
  }
}
```

---

## 🗄️ Migración de Base de Datos

La migración `AddUserAuthFields` agrega los siguientes campos a la tabla `users`:

- `password` (varchar, nullable) - Hash de la contraseña
- `emailVerified` (boolean, default false) - Estado de verificación
- `emailVerificationToken` (varchar, nullable) - Token de verificación
- `emailVerificationTokenExpires` (timestamp, nullable) - Expiración del token
- `resetPasswordToken` (varchar, nullable) - Token de reset
- `resetPasswordTokenExpires` (timestamp, nullable) - Expiración del token

**Ejecutar migración:**
```bash
pnpm db:migrate
```

---

## 🔧 Configuración

### Variables de Entorno (.env)

```bash
# Authentication
FRONTEND_BASE_URL=http://localhost:3000
TOKEN_EXPIRATION_HOURS=24

# Email (for verification and password reset)
EMAIL_FROM=noreply@example.com
APP_NAME=Agent Skills API

# Email Provider (configure in production)
# SENDGRID_API_KEY=
# AWS_SES_ACCESS_KEY=
# AWS_SES_SECRET_KEY=
# AWS_SES_REGION=us-east-1
```

---

## 📦 Servicios Implementados

### PasswordHashService
- `hashPassword(password: string): Promise<string>`
- `comparePassword(password: string, hashedPassword: string): Promise<boolean>`

### TokenService
- `generateToken(): string`
- `hashToken(token: string): string`
- `getTokenExpirationDate(): Date`
- `generateEmailVerificationToken(): { token, hashedToken, expires }`
- `generatePasswordResetToken(): { token, hashedToken, expires }`

### EmailService (Mock)
- `sendVerificationEmail(to, verificationUrl, userName?)`
- `sendPasswordResetEmail(to, resetUrl, userName?)`
- `sendWelcomeEmail(to, userName?)`

**Nota:** El EmailService es un mock que loggea los emails. En producción, integrar con SendGrid, AWS SES, etc.

---

## 🛡️ Guards y Decorators

### AuthGuard
Protege rutas validando el `x-session-id` header.

**Uso:**
```typescript
@Get('protected')
@UseGuards(AuthGuard)
async protectedRoute(@User() user: UserDto) {
  return { user };
}
```

### User Decorator
Extrae el usuario autenticado del request.

**Uso:**
```typescript
@Get('profile')
@UseGuards(AuthGuard)
async getProfile(@User('id') userId: string) {
  return this.userService.findById(userId);
}
```

---

## 🧪 Testing

### Endpoints básicos:

```bash
# Registro con password
curl -X POST http://localhost:8004/auth/register/password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User",
    "sessionId": "test-session-123"
  }'

# Login con password
curl -X POST http://localhost:8004/auth/login/password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "sessionId": "test-session-456"
  }'

# Obtener usuario autenticado
curl -X GET http://localhost:8004/auth/me \
  -H "x-session-id: test-session-456"
```

---

## 📝 Flujo de Registro

1. Usuario se registra con email/password
2. Se genera hash de password con bcrypt
3. Se genera token de verificación de email
4. Se envía email de verificación (mock en logs)
5. Usuario hace click en link de verificación
6. Email se marca como verificado

---

## 📝 Flujo de Password Reset

1. Usuario solicita reset de password
2. Se genera token de reset
3. Se envía email con link de reset
4. Usuario hace click en link y establece nueva password
5. Nueva password se hashea y guarda
6. Token de reset se invalida

---

## 🔒 Seguridad

- ✅ Passwords hasheadas con bcrypt (salt rounds: 10)
- ✅ Tokens hashados antes de guardar en BD
- ✅ Tokens con expiración (24 horas por defecto)
- ✅ Prevención de enumeración de emails en password reset
- ✅ Guards para proteger rutas sensibles
- ✅ Validación de datos con class-validator

---

## 🚀 Próximos Pasos (Opcional)

- [ ] Integrar con proveedor de email real (SendGrid, AWS SES)
- [ ] Agregar refresh tokens
- [ ] Implementar rate limiting
- [ ] Agregar 2FA (Two-Factor Authentication)
- [ ] OAuth2 / Social Login (Google, GitHub)
- [ ] Auditoría de logs de seguridad
