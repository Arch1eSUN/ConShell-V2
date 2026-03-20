import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="global-action-btn"
      title={i18n.language === 'en' ? 'Switch to Chinese' : '切换为英文'}
    >
      <span className="font-mono text-xs font-semibold tracking-wider">
        {i18n.language === 'en' ? 'EN' : '中'}
      </span>
    </button>
  );
}
