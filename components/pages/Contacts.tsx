'use client';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { api, contentText, type SiteContent } from '@/lib/api';

interface SectionTitle {
  title: string;
  subtitle?: string;
}

/** Поля формы обратной связи. */
type ContactFormState = { name: string; email: string; subject: string; message: string };

const EMPTY_FORM: ContactFormState = { name: '', email: '', subject: '', message: '' };

/** Уведомление под формой: подтверждение отправки или причина ошибки. */
type Notice = { kind: 'success' | 'error'; text: string };

export function Contacts() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [sectionTitle, setSectionTitle] = useState<SectionTitle>({
    title: 'Свяжитесь с нами',
    subtitle: 'Оставьте свое сообщение или свяжитесь с нами любым удобным способом'
  });
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadContent();
    loadSectionTitle();
  }, []);

  const loadContent = async () => {
    const data = await api.content.get('contacts', 'main');
    if (data) setContent(data);
  };

  const loadSectionTitle = async () => {
    const data = await api.sectionTitles.get('contacts', 'main');
    if (data) setSectionTitle({ title: data.title, subtitle: data.subtitle ?? undefined });
  };

  /** Обработчик поля: любая правка применяется к актуальному состоянию формы. */
  const updateField =
    (field: keyof ContactFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Повторный клик по «Отправляем...» не должен создавать второе письмо.
    if (sending) return;

    setNotice(null);
    setSending(true);
    try {
      await api.contact.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setForm(EMPTY_FORM);
      setNotice({
        kind: 'success',
        text: 'Спасибо! Сообщение отправлено — мы ответим на указанный email.',
      });
    } catch (error) {
      // Текст уже человеческий: его формирует lib/api.ts (таймаут, сеть) или API-роут.
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Не удалось отправить сообщение',
      });
    } finally {
      // Кнопка разблокируется всегда: и после ошибки, и после таймаута.
      setSending(false);
    }
  };

  return (
    <div className="flex-1 animate-fadeIn">
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 text-center animate-slideInUp">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-4">
            <span className="text-sm font-medium text-blue-600">📞 Контакты</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
            {sectionTitle.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {sectionTitle.subtitle}
          </p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-2xl p-8 md:p-12 mb-12 text-white animate-scaleIn">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                      <img
                        src="/64px-Telegram_logo.svg.png"
                        alt="Telegram"
                        className="w-12 h-12"
                      />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black">Telegram Бот</h2>
                  </div>
                  <p className="text-lg md:text-xl mb-4 text-blue-50">
                    Запись на тренировки и игры через наш бот!
                  </p>
                  <p className="text-sm md:text-base text-blue-100">
                    Быстро, удобно и всегда под рукой. Записывайтесь на тренировки, следите за расписанием игр и получайте уведомления.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <a
                    href="https://t.me/svyatogor_hockey_club_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    <img
                      src="/64px-Telegram_logo.svg.png"
                      alt="Telegram"
                      className="w-6 h-6"
                    />
                    Открыть бота
                  </a>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white p-8 rounded-2xl shadow-md text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp" style={{animationDelay: '0.1s'}}>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="text-orange-600" size={28} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">Email</h3>
                <a
                  href={`mailto:${contentText(content?.content.email) || 'info@hksvyatogor.ru'}`}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {contentText(content?.content.email) || 'info@hksvyatogor.ru'}
                </a>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-md text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp" style={{animationDelay: '0.2s'}}>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="text-orange-600" size={28} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">Телефон</h3>
                <a
                  href={`tel:${contentText(content?.content.phone) || '+7 (XXX) XXX-XX-XX'}`}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {contentText(content?.content.phone) || '+7 (XXX) XXX-XX-XX'}
                </a>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-md text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp" style={{animationDelay: '0.3s'}}>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="text-orange-600" size={28} />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">Адрес</h3>
                <p className="text-gray-700">
                  {contentText(content?.content.address) || 'Москва, Зеленоград'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
              <h2 className="text-3xl font-bold mb-6 text-gray-900 text-center">
                Напишите нам
              </h2>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Имя
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={updateField('name')}
                      disabled={sending}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Ваше имя"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      maxLength={200}
                      value={form.email}
                      onChange={updateField('email')}
                      disabled={sending}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="ivan@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Тема
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    maxLength={150}
                    value={form.subject}
                    onChange={updateField('subject')}
                    disabled={sending}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Тема сообщения"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Сообщение
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    minLength={10}
                    maxLength={5000}
                    value={form.message}
                    onChange={updateField('message')}
                    disabled={sending}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Ваше сообщение..."
                  ></textarea>
                </div>

                {notice && (
                  <div
                    role={notice.kind === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={
                      notice.kind === 'success'
                        ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800'
                        : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800'
                    }
                  >
                    {notice.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full md:w-auto px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                >
                  {sending ? 'Отправляем...' : 'Отправить сообщение'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
