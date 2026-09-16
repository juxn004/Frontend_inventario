/**
 * Auth Unificado - Sistema de Inventario (localStorage)
 * Login + Registro en una sola página con tabs
 * Funcionalidades: toggle password, strength meter, validaciones, recovery
 * Notifica cambios via BroadcastChannel para actualización en tiempo real
 */

// Canal para notificar cambios a otras pestañas (dashboard, etc.)
const authChannel = new BroadcastChannel('inventario_updates');

function notificarCambioDatos() {
    authChannel.postMessage({ type: 'dataChanged', source: 'auth', timestamp: Date.now() });
    console.log("📡 Notificación enviada: dataChanged (auth)");
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("🔐 LOGIN.JS CARGADO - Login + Registro unificado (localStorage)");
    
    initTabs();
    initTogglePassword();
    initPasswordStrength();
    initLoginForm();
    initRegisterForm();
    initForgotPassword();
    checkRememberMe();
});

// =========================================================================
// TABS: LOGIN <-> REGISTRO
// =========================================================================
function initTabs() {
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const loginPanel = document.getElementById("loginPanel");
    const registerPanel = document.getElementById("registerPanel");
    const indicator = document.getElementById("tabIndicator");
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");

    function showLogin() {
        loginTab.classList.add("active");
        loginTab.setAttribute("aria-selected", "true");
        loginPanel.classList.add("active");
        loginPanel.hidden = false;
        
        registerTab.classList.remove("active");
        registerTab.setAttribute("aria-selected", "false");
        registerPanel.classList.remove("active");
        registerPanel.hidden = true;
        
        indicator.style.transform = "translateX(0)";
        clearForms();
    }

    function showRegister() {
        registerTab.classList.add("active");
        registerTab.setAttribute("aria-selected", "true");
        registerPanel.classList.add("active");
        registerPanel.hidden = false;
        
        loginTab.classList.remove("active");
        loginTab.setAttribute("aria-selected", "false");
        loginPanel.classList.remove("active");
        loginPanel.hidden = true;
        
        indicator.style.transform = "translateX(100%)";
        clearForms();
    }

    loginTab?.addEventListener("click", showLogin);
    registerTab?.addEventListener("click", showRegister);
    switchToRegister?.addEventListener("click", (e) => { e.preventDefault(); showRegister(); });
    switchToLogin?.addEventListener("click", (e) => { e.preventDefault(); showLogin(); });

    // Soporte teclado
    [loginTab, registerTab].forEach(tab => {
        tab?.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                tab === loginTab ? showRegister() : showLogin();
            }
        });
    });
}

function clearForms() {
    document.getElementById("loginForm")?.reset();
    document.getElementById("registerForm")?.reset();
    document.getElementById("loginForm")?.classList.remove("was-validated");
    document.getElementById("registerForm")?.classList.remove("was-validated");
    hideAlert(document.getElementById("authAlert"));
    
    // Reset strength meter
    const bar = document.getElementById("passwordStrengthBar");
    const text = document.getElementById("passwordStrengthText");
    if (bar) bar.style.width = "0%";
    if (text) text.textContent = "";
    document.querySelectorAll("#passwordRequirements li").forEach(li => li.classList.remove("met"));
}

// =========================================================================
// MOSTRAR/OCULTAR CONTRASEÑA (TODOS LOS CAMPOS)
// =========================================================================
function initTogglePassword() {
    const toggles = [
        { btn: "toggleLoginPassword", input: "loginPassword" },
        { btn: "toggleRegPassword", input: "regPassword" },
        { btn: "toggleConfirmPassword", input: "confirmPassword" }
    ];

    toggles.forEach(({ btn, input }) => {
        const btnEl = document.getElementById(btn);
        const inputEl = document.getElementById(input);
        if (btnEl && inputEl) {
            btnEl.addEventListener("click", () => {
                const isPassword = inputEl.type === "password";
                inputEl.type = isPassword ? "text" : "password";
                const icon = btnEl.querySelector("i");
                if (icon) {
                    icon.classList.toggle("fa-eye");
                    icon.classList.toggle("fa-eye-slash");
                }
                btnEl.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
            });
        }
    });
}

// =========================================================================
// PASSWORD STRENGTH METER
// =========================================================================
function initPasswordStrength() {
    const passwordInput = document.getElementById("regPassword");
    const strengthBar = document.getElementById("passwordStrengthBar");
    const strengthText = document.getElementById("passwordStrengthText");

    if (!passwordInput || !strengthBar || !strengthText) return;

    passwordInput.addEventListener("input", () => {
        const password = passwordInput.value;
        const strength = calculatePasswordStrength(password);
        
        strengthBar.style.width = `${strength.percent}%`;
        strengthBar.className = `password-strength-bar ${strength.class}`;
        strengthBar.setAttribute("aria-valuenow", strength.percent);
        
        strengthText.textContent = strength.text;
        strengthText.className = `password-strength-text text-${strength.color}`;
        
        updateRequirements(password);
    });

    // También validar al confirmar
    const confirmInput = document.getElementById("confirmPassword");
    if (confirmInput) {
        confirmInput.addEventListener("input", () => {
            if (confirmInput.value && passwordInput.value !== confirmInput.value) {
                confirmInput.setCustomValidity("Las contraseñas no coinciden");
            } else {
                confirmInput.setCustomValidity("");
            }
        });
    }
}

function calculatePasswordStrength(password) {
    if (!password) {
        return { percent: 0, class: '', text: '', color: 'muted' };
    }

    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (checks.uppercase) score += 1;
    if (checks.lowercase) score += 1;
    if (checks.number) score += 1;
    if (checks.special) score += 1;
    if (password.length >= 12) score += 1;

    const percent = Math.min((score / 7) * 100, 100);

    if (percent <= 25) return { percent, class: 'bg-danger', text: 'Muy débil', color: 'danger' };
    if (percent <= 50) return { percent, class: 'bg-warning', text: 'Débil', color: 'warning' };
    if (percent <= 75) return { percent, class: 'bg-info', text: 'Media', color: 'info' };
    return { percent, class: 'bg-success', text: 'Fuerte', color: 'success' };
}

function updateRequirements(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    Object.keys(requirements).forEach(key => {
        const li = document.querySelector(`#passwordRequirements li[data-req="${key}"]`);
        if (li) {
            li.classList.toggle("met", requirements[key]);
        }
    });
}

// =========================================================================
// FORMULARIO LOGIN (localStorage)
// =========================================================================
function initLoginForm() {
    const form = document.getElementById("loginForm");
    const alertDiv = document.getElementById("authAlert");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert(alertDiv);
        
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            showAlert(alertDiv, "danger", "Por favor completa todos los campos correctamente");
            return;
        }

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const remember = document.getElementById("rememberMe").checked;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Iniciando...';

        try {
            await simulateLogin(email, password);
            
            if (remember) {
                localStorage.setItem("rememberEmail", email);
            } else {
                localStorage.removeItem("rememberEmail");
            }

            showAlert(alertDiv, "success", "¡Inicio de sesión exitoso! Redirigiendo al dashboard...");
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);

        } catch (error) {
            showAlert(alertDiv, "danger", error.message || "Error al iniciar sesión");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    });
}

// Simulación login (localStorage)
function simulateLogin(email, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const users = {
                "admin@inventario.com": "admin123",
                "usuario@empresa.com": "123456",
                "demo@test.com": "demo123"
            };

            if (users[email] && users[email] === password) {
                sessionStorage.setItem("user", JSON.stringify({
                    email,
                    name: email.split("@")[0],
                    role: email.includes("admin") ? "admin" : "user",
                    loginTime: new Date().toISOString()
                }));
                resolve({ success: true });
            } else {
                reject(new Error("Credenciales incorrectas. Prueba: admin@inventario.com / admin123"));
            }
        }, 800);
    });
}

// =========================================================================
// FORMULARIO REGISTRO (localStorage - solo email + password)
// =========================================================================
function initRegisterForm() {
    const form = document.getElementById("registerForm");
    const alertDiv = document.getElementById("authAlert");
    const successModal = new bootstrap.Modal(document.getElementById("successModal"));

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert(alertDiv);
        
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            showAlert(alertDiv, "danger", "Por favor completa todos los campos correctamente");
            return;
        }

        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        
        if (password !== confirmPassword) {
            showAlert(alertDiv, "danger", "Las contraseñas no coinciden");
            document.getElementById("confirmPassword").focus();
            return;
        }

        const strength = calculatePasswordStrength(password);
        if (strength.percent < 25) {
            showAlert(alertDiv, "warning", "La contraseña es muy débil. Usa al menos 6 caracteres.");
            return;
        }

        const userData = {
            email: document.getElementById("regEmail").value.trim(),
            password: password
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando cuenta...';

        try {
            await simulateRegister(userData);
            
            // Configurar modal de éxito para registro
            document.getElementById("successIcon").className = "fa-solid fa-user-check fa-2x text-success";
            document.getElementById("successTitle").textContent = "¡Cuenta creada exitosamente!";
            document.getElementById("successMessage").textContent = "Tu cuenta ha sido registrada. Ahora puedes iniciar sesión con tus credenciales.";
            document.getElementById("successAction").innerHTML = '<i class="fa-solid fa-sign-in-alt me-1"></i>Ir a Iniciar Sesión';
            document.getElementById("successAction").onclick = () => {
                const loginTab = document.getElementById("loginTab");
                if (loginTab) loginTab.click();
            };
            
            successModal.show();
            
            form.reset();
            form.classList.remove("was-validated");
            document.getElementById("passwordStrengthBar").style.width = "0%";
            document.getElementById("passwordStrengthText").textContent = "";
            document.querySelectorAll("#passwordRequirements li").forEach(li => li.classList.remove("met"));

        } catch (error) {
            showAlert(alertDiv, "danger", error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    });
}

// Simulación registro (localStorage)
function simulateRegister(userData) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existingEmails = JSON.parse(localStorage.getItem("registeredEmails") || "[]");
            
            if (existingEmails.includes(userData.email)) {
                reject(new Error("Este correo ya está registrado. Intenta con otro o inicia sesión."));
                return;
            }

            existingEmails.push(userData.email);
            localStorage.setItem("registeredEmails", JSON.stringify(existingEmails));
            
            const users = JSON.parse(localStorage.getItem("users") || "{}");
            users[userData.email] = {
                ...userData,
                password: hashPassword(userData.password),
                createdAt: new Date().toISOString(),
                role: "user"
            };
            localStorage.setItem("users", JSON.stringify(users));

            console.log("✅ Usuario registrado (localStorage):", userData.email);
            resolve({ success: true, user: userData });
        }, 1000);
    });
}

// Hash simple para demo (en producción usar bcrypt en backend)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// =========================================================================
// RECUPERAR CONTRASEÑA
// =========================================================================
function initForgotPassword() {
    const forgotForm = document.getElementById("forgotForm");
    const forgotAlert = document.getElementById("forgotAlert");
    const forgotModal = document.getElementById("forgotModal");
    const successModal = new bootstrap.Modal(document.getElementById("successModal"));

    if (!forgotForm) return;

    forgotModal?.addEventListener("show.bs.modal", () => {
        hideAlert(forgotAlert);
        forgotForm.reset();
        document.getElementById("forgotEmail").value = document.getElementById("loginEmail").value || "";
    });

    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideAlert(forgotAlert);

        const email = document.getElementById("forgotEmail").value.trim();
        
        if (!email || !isValidEmail(email)) {
            showAlert(forgotAlert, "danger", "Por favor ingresa un correo válido");
            return;
        }

        const submitBtn = forgotForm.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

        try {
            // Simular envío de correo de recuperación
            await simulatePasswordReset(email);
            
            const modalInstance = bootstrap.Modal.getInstance(forgotModal);
            modalInstance?.hide();
            
            // Configurar modal éxito para recovery
            document.getElementById("successIcon").className = "fa-solid fa-check fa-2x text-success";
            document.getElementById("successTitle").textContent = "¡Correo enviado!";
            document.getElementById("successMessage").textContent = "Hemos enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada (y spam).";
            document.getElementById("successAction").innerHTML = '<i class="fa-solid fa-sign-in-alt me-1"></i>Volver al login';
            document.getElementById("successAction").onclick = null;
            
            setTimeout(() => successModal.show(), 300);

        } catch (error) {
            showAlert(forgotAlert, "danger", error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    });
}

// Simulación recuperación (localStorage)
function simulatePasswordReset(email) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const registeredEmails = [
                "admin@inventario.com",
                "usuario@empresa.com", 
                "demo@test.com",
                ...JSON.parse(localStorage.getItem("registeredEmails") || "[]")
            ];
            console.log(`🔑 Recovery request for: ${email} (registered: ${registeredEmails.includes(email)})`);
            resolve({ success: true });
        }, 1000);
    });
}

// =========================================================================
// RECORDARME
// =========================================================================
function checkRememberMe() {
    const savedEmail = localStorage.getItem("rememberEmail");
    const emailInput = document.getElementById("loginEmail");
    const rememberCheckbox = document.getElementById("rememberMe");

    if (savedEmail && emailInput && rememberCheckbox) {
        emailInput.value = savedEmail;
        rememberCheckbox.checked = true;
        document.getElementById("loginPassword")?.focus();
    }
}

// =========================================================================
// UTILIDADES
// =========================================================================
function showAlert(container, type, message) {
    if (!container) return;
    
    const icons = {
        success: "fa-circle-check",
        danger: "fa-circle-exclamation",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info"
    };
    
    container.className = `alert alert-${type} alert-dismissible fade show`;
    container.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    `;
    container.classList.remove("d-none");
}

function hideAlert(container) {
    if (!container) return;
    container.classList.add("d-none");
    container.innerHTML = "";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =========================================================================
// FUNCIONES GLOBALES
// =========================================================================
window.logout = function() {
    sessionStorage.removeItem("user");
    localStorage.removeItem("rememberEmail");
    window.location.href = "login.html";
};

window.checkAuth = function() {
    const user = sessionStorage.getItem("user");
    if (!user && !window.location.pathname.includes("login.html") && !window.location.pathname.includes("register.html")) {
        window.location.href = "login.html";
    }
    return user ? JSON.parse(user) : null;
};