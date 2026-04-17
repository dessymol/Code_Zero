import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LOCALE_KEY = 'appLocale';

const MESSAGES = {
  en: {
    sign_in: 'Sign In',
    forgot_password: 'Forgot Password',
    enter_credentials: 'Enter your credentials to continue.',
    reset_password: 'Reset Password',
    back_to_login: 'Back to Login',
    account_type: 'Account Type',
    email_address: 'Email Address',
    send_otp: 'Send OTP',
    verify_otp: 'Verify OTP',
    resend_otp: 'Resend OTP',
    new_password: 'New Password',
    confirm_password: 'Confirm Password',
    reset_action: 'Reset Password',
    remember_me: 'Remember me',
    signing_in: 'Signing in...',
  },
  es: {
    sign_in: 'Iniciar Sesion',
    forgot_password: 'Olvido su contrasena',
    enter_credentials: 'Ingrese sus credenciales para continuar.',
    reset_password: 'Restablecer Contrasena',
    back_to_login: 'Volver al Inicio de Sesion',
    account_type: 'Tipo de Cuenta',
    email_address: 'Correo Electronico',
    send_otp: 'Enviar OTP',
    verify_otp: 'Verificar OTP',
    resend_otp: 'Reenviar OTP',
    new_password: 'Nueva Contrasena',
    confirm_password: 'Confirmar Contrasena',
    reset_action: 'Restablecer Contrasena',
    remember_me: 'Recordarme',
    signing_in: 'Iniciando sesion...',
  },
  fr: {
    sign_in: 'Connexion',
    forgot_password: 'Mot de passe oublie',
    enter_credentials: 'Saisissez vos identifiants pour continuer.',
    reset_password: 'Reinitialiser le mot de passe',
    back_to_login: 'Retour a la connexion',
    account_type: 'Type de compte',
    email_address: 'Adresse e-mail',
    send_otp: 'Envoyer OTP',
    verify_otp: 'Verifier OTP',
    resend_otp: 'Renvoyer OTP',
    new_password: 'Nouveau mot de passe',
    confirm_password: 'Confirmer le mot de passe',
    reset_action: 'Reinitialiser le mot de passe',
    remember_me: 'Se souvenir de moi',
    signing_in: 'Connexion...',
  },
  ar: {
    sign_in: 'تسجيل الدخول',
    forgot_password: 'نسيت كلمة المرور',
    enter_credentials: 'ادخل بيانات الاعتماد للمتابعة.',
    reset_password: 'اعادة تعيين كلمة المرور',
    back_to_login: 'العودة لتسجيل الدخول',
    account_type: 'نوع الحساب',
    email_address: 'البريد الالكتروني',
    send_otp: 'ارسال رمز OTP',
    verify_otp: 'تحقق من OTP',
    resend_otp: 'اعادة ارسال OTP',
    new_password: 'كلمة المرور الجديدة',
    confirm_password: 'تأكيد كلمة المرور',
    reset_action: 'اعادة تعيين كلمة المرور',
    remember_me: 'تذكرني',
    signing_in: 'جار تسجيل الدخول...',
  },
};

const LocaleContext = createContext(null);

export const LocaleProvider = ({ children }) => {
  const [locale, setLocale] = useState(localStorage.getItem(LOCALE_KEY) || 'en');

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo(() => {
    const t = (key) => MESSAGES[locale]?.[key] || MESSAGES.en[key] || key;
    return { locale, setLocale, t, supportedLocales: Object.keys(MESSAGES) };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
};
