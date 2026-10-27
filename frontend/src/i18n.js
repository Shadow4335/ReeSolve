// Light i18n (no dependency): English / Hindi dictionaries, a context, and a useT() hook.
// Anything missing from `hi` falls back to English; user data and backend text are never translated.
//
// NATIVE-SPEAKER REVIEW NEEDED (written carefully, but a fluent reviewer should confirm tone and wording):
//   - 'status.breached' -> "समय सीमा पार" (literal "past the deadline"; a shorter govt-style term may exist)
//   - 'chip.askFixed', 'btn.noFixed' (colloquial phrasing for "Was this fixed?" / "No, still a problem")
//   - 'btn.follow' ("फ़ॉलो करें" is borrowed from English; consider "अनुसरण करें" / "इस पर नज़र रखें")
//   - 'footer.disclaimer' (legal-style sentence), 'footer.aboutText'
//   - 'login.sub', 'login.codeError', 'overview.sub' (friendly tone for formal register)
//   - 'role.staff' -> "{name} कर्मचारी" (department names themselves stay in English: they are data)
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'reesolve.lang'

export const en = {
  'util.skip': 'Skip to main content', 'util.textSize': 'Text size', 'util.smaller': 'Decrease text size',
  'util.normal': 'Default text size', 'util.larger': 'Increase text size', 'util.language': 'Language',
  'brand.tagline': 'Your city, in sync',
  'nav.overview': 'Overview', 'nav.report': 'Report a problem', 'nav.projects': 'City projects', 'nav.requests': 'My requests',
  'nav.queue': 'Task queue', 'nav.operations': 'Operations', 'nav.main': 'Main navigation',
  'role.viewingAs': 'Viewing as', 'role.resident': 'Resident', 'role.admin': 'City admin', 'role.department': 'Department: {name}',
  'role.staff': '{name} staff', 'auth.signOut': 'Sign out', 'clock.label': 'Simulated time',
  'footer.about': 'About this prototype',
  'footer.aboutText': 'ReeSolve is a hackathon prototype of a civic complaint platform. A case only closes when evidence confirms it.',
  'footer.helpline': 'Helpline', 'footer.helplineText': 'For danger to life, call 112.', 'footer.quick': 'Quick links',
  'footer.updated': 'Last updated',
  'footer.disclaimer': 'Prototype built for a hackathon. Not an official Government of India website.',
  'status.key': 'Status key', 'status.onTrack': 'On track', 'status.warning': 'Warning', 'status.breached': 'Breached', 'status.paused': 'Paused',
  'chip.reported': 'Reported', 'chip.inProgress': 'In progress', 'chip.waiting': 'Waiting on another team', 'chip.completed': 'Completed',
  'chip.reopened': 'Reopened', 'chip.askFixed': 'Was this fixed?',
  'overview.eyebrow': 'Welcome back', 'overview.title': 'Hello, neighbor', 'overview.sub': "Here's what's happening around your city today.",
  'overview.heroTitle': 'A better block starts with one small report.',
  'overview.heroText': "Tell us what and where. We'll route it to the right team and check with you that it's really fixed.",
  'overview.thisMonth': 'Reports this month', 'overview.pulse': 'Neighborhood pulse', 'overview.allOnTrack': 'All on track',
  'overview.mostlyOnTrack': 'Mostly on track', 'overview.needsAttention': 'Needs attention', 'overview.whatReport': 'What would you like to report?',
  'overview.around': 'Around the neighborhood', 'overview.near': 'Reports near you',
  'report.eyebrow': 'Report a problem', 'report.title': 'What needs fixing?',
  'report.sub': 'Takes about a minute. Similar reports nearby are combined, so every report adds weight.',
  'track.eyebrow': 'My requests', 'track.title': 'Your reports', 'track.sub': "We only close a report once residents confirm it's fixed.",
  'projects.eyebrow': 'City projects', 'projects.title': 'Work around your area', 'projects.inProgress': 'In progress',
  'projects.done': 'Recently completed',
  'dept.eyebrow': 'Department {code}', 'dept.title': 'Task queue', 'dept.sub': 'Most urgent first. A task only closes once residents confirm the fix.',
  'admin.eyebrow': 'City admin', 'admin.title': 'Operations', 'admin.sub': 'Every decision the system makes, with the reason, as it happens.',
  'admin.feed': 'Live feed', 'admin.perf': 'Department performance',
  'btn.report': 'Report a problem', 'btn.submit': 'Submit report', 'btn.signIn': 'Sign in', 'btn.start': 'Start', 'btn.close': 'Close…',
  'btn.submitClosure': 'Submit closure', 'btn.yesFixed': "Yes, it's fixed", 'btn.noFixed': 'No, still a problem', 'btn.follow': 'Follow this request',
  'btn.startReport': 'Start a report →',
  'login.hello': 'Hello, neighbor', 'login.welcome': 'Welcome back', 'login.sub': "Sign in to see what's happening around your city today.",
  'login.tabs': 'Sign in as', 'login.resident': 'Resident', 'login.staff': 'Department staff', 'login.admin': 'Admin',
  'login.nameEmail': 'Your name or email', 'login.name': 'Your name', 'login.department': 'Department', 'login.chooseDept': 'Choose your department',
  'login.code': 'Demo access code', 'login.signingIn': 'Signing you in…', 'login.welcomeBtn': 'Welcome!',
  'login.demoIntro': 'Just looking around? Try a demo account.', 'login.tryResident': 'Try as resident', 'login.tryRoads': 'Try as Roads dept',
  'login.tryAdmin': 'Try as admin', 'login.demoNote': 'Demo sign-in only: nothing is sent anywhere. Admin demo code:',
  'login.errNameEmail': 'Tell us your name or email so we know who is signing in.', 'login.errName': 'Tell us your name so we know who is signing in.',
  'login.errDept': 'Pick your department so we can show your queue.', 'login.errCode': 'Enter the demo access code (it is shown just below the field).',
  'login.codeError': "That code doesn't match. For this demo, use {code}.", 'login.codeHint': 'Demo code: {code}',
  'panel.month': 'reports this month', 'panel.fixed': 'fixed and confirmed by residents', 'panel.promise': 'Fixed means confirmed fixed',
}

export const hi = {
  'util.skip': 'मुख्य सामग्री पर जाएँ', 'util.textSize': 'अक्षर का आकार', 'util.smaller': 'अक्षर छोटे करें',
  'util.normal': 'सामान्य अक्षर आकार', 'util.larger': 'अक्षर बड़े करें', 'util.language': 'भाषा',
  'brand.tagline': 'आपका शहर, तालमेल में',
  'nav.overview': 'अवलोकन', 'nav.report': 'समस्या दर्ज करें', 'nav.projects': 'शहर की परियोजनाएँ', 'nav.requests': 'मेरे अनुरोध',
  'nav.queue': 'कार्य सूची', 'nav.operations': 'संचालन', 'nav.main': 'मुख्य नेविगेशन',
  'role.viewingAs': 'इस रूप में देखें', 'role.resident': 'निवासी', 'role.admin': 'शहर प्रशासक', 'role.department': 'विभाग: {name}',
  'role.staff': '{name} कर्मचारी', 'auth.signOut': 'साइन आउट', 'clock.label': 'सिम्युलेटेड समय',
  'footer.about': 'इस प्रोटोटाइप के बारे में',
  'footer.aboutText': 'ReeSolve नागरिक शिकायत मंच का एक हैकथॉन प्रोटोटाइप है। कोई शिकायत तभी बंद होती है जब प्रमाण से उसकी पुष्टि हो जाए।',
  'footer.helpline': 'हेल्पलाइन', 'footer.helplineText': 'जान को ख़तरा होने पर 112 पर कॉल करें।', 'footer.quick': 'त्वरित लिंक',
  'footer.updated': 'अंतिम अद्यतन',
  'footer.disclaimer': 'यह हैकथॉन के लिए बनाया गया प्रोटोटाइप है। यह भारत सरकार की आधिकारिक वेबसाइट नहीं है।',
  'status.key': 'स्थिति संकेत', 'status.onTrack': 'समय पर', 'status.warning': 'चेतावनी', 'status.breached': 'समय सीमा पार', 'status.paused': 'रुका हुआ',
  'chip.reported': 'दर्ज', 'chip.inProgress': 'प्रगति पर', 'chip.waiting': 'दूसरी टीम की प्रतीक्षा', 'chip.completed': 'पूर्ण',
  'chip.reopened': 'दोबारा खोला गया', 'chip.askFixed': 'क्या यह ठीक हुआ?',
  'overview.eyebrow': 'वापसी पर स्वागत है', 'overview.title': 'नमस्ते, पड़ोसी', 'overview.sub': 'आज आपके शहर में क्या हो रहा है, यहाँ देखें।',
  'overview.heroTitle': 'एक छोटी शिकायत से बेहतर मोहल्ला बनता है।',
  'overview.heroText': 'हमें बताएँ क्या और कहाँ। हम उसे सही टीम तक पहुँचाएँगे और आपसे पूछेंगे कि वाकई ठीक हुआ या नहीं।',
  'overview.thisMonth': 'इस महीने की शिकायतें', 'overview.pulse': 'मोहल्ले की स्थिति', 'overview.allOnTrack': 'सब समय पर',
  'overview.mostlyOnTrack': 'अधिकतर समय पर', 'overview.needsAttention': 'ध्यान देने की ज़रूरत', 'overview.whatReport': 'आप क्या दर्ज करना चाहेंगे?',
  'overview.around': 'मोहल्ले में', 'overview.near': 'आपके पास की शिकायतें',
  'report.eyebrow': 'समस्या दर्ज करें', 'report.title': 'क्या ठीक करवाना है?',
  'report.sub': 'लगभग एक मिनट लगता है। आस-पास की मिलती-जुलती शिकायतें जोड़ दी जाती हैं, इसलिए हर शिकायत का वज़न बढ़ता है।',
  'track.eyebrow': 'मेरे अनुरोध', 'track.title': 'आपकी शिकायतें', 'track.sub': 'हम शिकायत तभी बंद करते हैं जब निवासी पुष्टि कर दें कि वह ठीक हो गई है।',
  'projects.eyebrow': 'शहर की परियोजनाएँ', 'projects.title': 'आपके क्षेत्र में काम', 'projects.inProgress': 'प्रगति पर', 'projects.done': 'हाल ही में पूर्ण',
  'dept.eyebrow': 'विभाग {code}', 'dept.title': 'कार्य सूची', 'dept.sub': 'सबसे ज़रूरी पहले। कार्य तभी बंद होता है जब निवासी सुधार की पुष्टि करें।',
  'admin.eyebrow': 'शहर प्रशासक', 'admin.title': 'संचालन', 'admin.sub': 'प्रणाली का हर निर्णय, कारण सहित, जैसे ही होता है।',
  'admin.feed': 'लाइव फ़ीड', 'admin.perf': 'विभागों का प्रदर्शन',
  'btn.report': 'समस्या दर्ज करें', 'btn.submit': 'शिकायत जमा करें', 'btn.signIn': 'साइन इन करें', 'btn.start': 'शुरू करें', 'btn.close': 'बंद करें…',
  'btn.submitClosure': 'समापन जमा करें', 'btn.yesFixed': 'हाँ, ठीक हो गया', 'btn.noFixed': 'नहीं, समस्या अब भी है', 'btn.follow': 'इस अनुरोध को फ़ॉलो करें',
  'btn.startReport': 'शिकायत शुरू करें →',
  'login.hello': 'नमस्ते, पड़ोसी', 'login.welcome': 'वापसी पर स्वागत है', 'login.sub': 'आज आपके शहर में क्या हो रहा है, यह देखने के लिए साइन इन करें।',
  'login.tabs': 'इस रूप में साइन इन करें', 'login.resident': 'निवासी', 'login.staff': 'विभाग कर्मचारी', 'login.admin': 'प्रशासक',
  'login.nameEmail': 'आपका नाम या ईमेल', 'login.name': 'आपका नाम', 'login.department': 'विभाग', 'login.chooseDept': 'अपना विभाग चुनें',
  'login.code': 'डेमो एक्सेस कोड', 'login.signingIn': 'साइन इन हो रहा है…', 'login.welcomeBtn': 'स्वागत है!',
  'login.demoIntro': 'बस देखना चाहते हैं? डेमो खाता आज़माएँ।', 'login.tryResident': 'निवासी के रूप में आज़माएँ', 'login.tryRoads': 'सड़क विभाग के रूप में आज़माएँ',
  'login.tryAdmin': 'प्रशासक के रूप में आज़माएँ', 'login.demoNote': 'यह केवल डेमो साइन-इन है: कुछ भी कहीं नहीं भेजा जाता। एडमिन डेमो कोड:',
  'login.errNameEmail': 'कृपया अपना नाम या ईमेल बताएँ ताकि हमें पता रहे कि कौन साइन इन कर रहा है।', 'login.errName': 'कृपया अपना नाम बताएँ ताकि हमें पता रहे कि कौन साइन इन कर रहा है।',
  'login.errDept': 'कृपया अपना विभाग चुनें ताकि हम आपकी कार्य सूची दिखा सकें।', 'login.errCode': 'डेमो एक्सेस कोड दर्ज करें (वह इस फ़ील्ड के ठीक नीचे दिखाया गया है)।',
  'login.codeError': 'यह कोड मेल नहीं खाता। इस डेमो के लिए {code} का उपयोग करें।', 'login.codeHint': 'डेमो कोड: {code}',
  'panel.month': 'इस महीने की शिकायतें', 'panel.fixed': 'ठीक हुईं और निवासियों द्वारा पुष्ट', 'panel.promise': 'ठीक हुआ यानी पुष्टि के बाद ही ठीक',
}

const I18nContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => en[k] ?? k })

function readLang() {
  try { return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en' } catch { return 'en' }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const setLang = useCallback((l) => {
    try { localStorage.setItem(KEY, l) } catch { /* private mode */ }
    setLangState(l)
  }, [])
  const t = useCallback((key, vars) => {
    let s = (lang === 'hi' && hi[key]) || en[key] || key
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    return s
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return createElement(I18nContext.Provider, { value }, children)
}

export const useT = () => useContext(I18nContext).t
export const useLang = () => { const { lang, setLang } = useContext(I18nContext); return { lang, setLang } }
