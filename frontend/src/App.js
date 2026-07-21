import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ToastContainer, toast } from 'react-toastify';
import { io } from 'socket.io-client';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import * as Yup from 'yup';
import ChannelModals from './components/ChannelModals';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import {
  addChannel,
  addMessage,
  fetchChatData,
  removeChannel,
  renameChannel,
  setCurrentChannelId,
} from './store';
import { cleanProfanity } from './utils/profanity';

const AuthContext = createContext(null);

const getLoginSchema = (t) => Yup.object({
  username: Yup.string().required(t('validation.required')),
  password: Yup.string().required(t('validation.required')),
});

const getSignupSchema = (t) => Yup.object({
  username: Yup.string()
    .trim()
    .required(t('validation.required'))
    .min(3, t('validation.usernameLength'))
    .max(20, t('validation.usernameLength')),
  password: Yup.string()
    .required(t('validation.required'))
    .min(6, t('validation.passwordMin')),
  confirmPassword: Yup.string()
    .required(t('validation.required'))
    .oneOf([Yup.ref('password')], t('validation.passwordsMustMatch')),
});

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));

  const logIn = ({ token: newToken, username: newUsername }) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const logOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  const value = useMemo(() => ({
    token,
    username,
    loggedIn: Boolean(token),
    logIn,
    logOut,
  }), [token, username]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const Header = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    auth.logOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <Link className="app-brand" to="/">{t('chat')}</Link>
      {auth.loggedIn && (
        <button className="logout-btn" onClick={handleLogout} type="button">
          {t('logout')}
        </button>
      )}
    </header>
  );
};

const PrivateRoute = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.loggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const ChannelMenu = ({ channel, onRename, onRemove }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="channel-menu dropdown" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label={t('channelManage')}
        className="channel-menu-toggle dropdown-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        ▾
      </button>
      {open && (
        <div className="channel-menu-dropdown dropdown-menu show">
          <button
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              onRename(channel.id);
            }}
            type="button"
          >
            {t('rename')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              onRemove(channel.id);
            }}
            type="button"
          >
            {t('remove')}
          </button>
        </div>
      )}
    </div>
  );
};

const HomePage = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const dispatch = useDispatch();
  const {
    channels,
    messages,
    currentChannelId,
    loading,
    error,
  } = useSelector((state) => state.chat);
  const currentChannel = channels.find(({ id }) => id === currentChannelId);
  const currentMessages = messages.filter(
    (message) => String(message.channelId) === String(currentChannelId),
  );
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    dispatch(fetchChatData(auth.token));
  }, [auth.token, dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(t(error));
    }
  }, [error, t]);

  useEffect(() => {
    const socket = io({
      forceNew: true,
    });

    socket.on('newMessage', (message) => {
      dispatch(addMessage(message));
    });

    socket.on('newChannel', (channel) => {
      dispatch(addChannel(channel));
    });

    socket.on('renameChannel', (channel) => {
      dispatch(renameChannel(channel));
    });

    socket.on('removeChannel', (payload) => {
      dispatch(removeChannel(payload));
    });

    return () => {
      socket.disconnect();
    };
  }, [dispatch]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const body = messageText.trim();
    if (!body || !currentChannelId || sending) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const response = await axios.post('/api/v1/messages', {
        body: cleanProfanity(body),
        channelId: currentChannelId,
        username: auth.username,
      }, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 10000,
      });
      dispatch(addMessage(response.data));
      setMessageText('');
    } catch (err) {
      setSendError(t('networkError'));
      toast.error(t('networkError'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="chat-page">
        <p>{t('loading')}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="chat-page">
        <p className="error">{t(error)}</p>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <aside className="channels">
        <div className="channels-header">
          <h2>{t('channels')}</h2>
          <button
            aria-label={t('addChannel')}
            className="add-channel-btn"
            onClick={() => setModal({ type: 'add' })}
            type="button"
          >
            {t('addChannel')}
          </button>
        </div>
        <ul className="channels-list">
          {channels.map((channel) => {
            const isActive = channel.id === currentChannelId;

            return (
              <li key={channel.id}>
                <div className={isActive ? 'channel-row active' : 'channel-row'}>
                  <button
                    className="channel"
                    onClick={() => dispatch(setCurrentChannelId(channel.id))}
                    type="button"
                  >
                    <span className="channel-name">{`# ${channel.name}`}</span>
                  </button>
                  {channel.removable && (
                    <ChannelMenu
                      channel={channel}
                      onRemove={(channelId) => setModal({ type: 'remove', channelId })}
                      onRename={(channelId) => setModal({ type: 'rename', channelId })}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="chat">
        <header className="chat-header">
          <h2 className="channel-name">{`# ${currentChannel?.name ?? 'general'}`}</h2>
        </header>
        <div className="messages">
          {currentMessages.map((message) => (
            <p className="message" key={message.id}>
              <b>{message.username}</b>
              {`: ${message.body}`}
            </p>
          ))}
        </div>
        <form className="message-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="message">{t('newMessage')}</label>
          <input
            aria-label={t('newMessage')}
            autoFocus
            disabled={sending}
            id="message"
            name="body"
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={t('enterMessage')}
            type="text"
            value={messageText}
          />
          <button disabled={sending} type="submit">{t('send')}</button>
          {sendError && <span className="error">{sendError}</span>}
        </form>
      </section>
      <ChannelModals
        modal={modal}
        onHide={() => setModal(null)}
        token={auth.token}
      />
    </main>
  );
};

const LoginPage = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const loginSchema = useMemo(() => getLoginSchema(t), [t]);

  if (auth.loggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>{t('loginTitle')}</h1>
        <Formik
          initialValues={{ username: '', password: '' }}
          validationSchema={loginSchema}
          onSubmit={async (values, { setErrors, setSubmitting }) => {
            try {
              const response = await axios.post('/api/v1/login', values);
              auth.logIn(response.data);
              navigate(from, { replace: true });
            } catch (error) {
              setErrors({ auth: t('invalidCredentials') });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, isSubmitting }) => (
            <Form className="form">
              <label htmlFor="username">{t('nickname')}</label>
              <Field autoComplete="username" id="username" name="username" type="text" />
              <ErrorMessage className="error" component="div" name="username" />

              <label htmlFor="password">{t('password')}</label>
              <Field autoComplete="current-password" id="password" name="password" type="password" />
              <ErrorMessage className="error" component="div" name="password" />

              {errors.auth && <div className="error">{errors.auth}</div>}
              <button disabled={isSubmitting} type="submit">{t('loginButton')}</button>
              <p className="auth-link">
                {t('noAccount')}
                {' '}
                <Link to="/signup">{t('registration')}</Link>
              </p>
            </Form>
          )}
        </Formik>
      </section>
    </main>
  );
};

const SignupPage = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const signupSchema = useMemo(() => getSignupSchema(t), [t]);

  if (auth.loggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>{t('signupTitle')}</h1>
        <Formik
          initialValues={{ username: '', password: '', confirmPassword: '' }}
          validationSchema={signupSchema}
          onSubmit={async (values, { setFieldError, setSubmitting }) => {
            try {
              const response = await axios.post('/api/v1/signup', {
                username: values.username.trim(),
                password: values.password,
              });
              auth.logIn(response.data);
              navigate('/', { replace: true });
            } catch (error) {
              if (error.response?.status === 409) {
                setFieldError('username', t('userExists'));
              } else {
                setFieldError('username', t('registrationFailed'));
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="form">
              <label htmlFor="signup-username">{t('username')}</label>
              <Field autoComplete="username" id="signup-username" name="username" type="text" />
              <ErrorMessage className="error" component="div" name="username" />

              <label htmlFor="signup-password">{t('password')}</label>
              <Field autoComplete="new-password" id="signup-password" name="password" type="password" />
              <ErrorMessage className="error" component="div" name="password" />

              <label htmlFor="signup-confirmPassword">{t('confirmPassword')}</label>
              <Field
                autoComplete="new-password"
                id="signup-confirmPassword"
                name="confirmPassword"
                type="password"
              />
              <ErrorMessage className="error" component="div" name="confirmPassword" />

              <button disabled={isSubmitting} type="submit">{t('signupButton')}</button>
              <p className="auth-link">
                {t('haveAccount')}
                {' '}
                <Link to="/login">{t('loginLink')}</Link>
              </p>
            </Form>
          )}
        </Formik>
      </section>
    </main>
  );
};

const NotFoundPage = () => {
  const { t } = useTranslation();

  return (
    <main className="page">
      <section className="panel">
        <h1>{t('notFoundTitle')}</h1>
        <p>{t('notFoundText')}</p>
        <Link className="button" to="/">{t('goHome')}</Link>
      </section>
    </main>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <Routes>
            <Route
              path="/"
              element={(
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              )}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <ToastContainer position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
