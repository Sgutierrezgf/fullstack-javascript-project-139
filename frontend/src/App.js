import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
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
import './App.css';
import {
  addChannel,
  addMessage,
  fetchChatData,
  removeChannel,
  renameChannel,
  setCurrentChannelId,
} from './store';

const AuthContext = createContext(null);

const loginSchema = Yup.object({
  username: Yup.string().required('Required'),
  password: Yup.string().required('Required'),
});

const signupSchema = Yup.object({
  username: Yup.string()
    .trim()
    .required('Required')
    .min(3, 'From 3 to 20 characters')
    .max(20, 'From 3 to 20 characters'),
  password: Yup.string()
    .required('Required')
    .min(6, 'Min 6 characters'),
  confirmPassword: Yup.string()
    .required('Required')
    .oneOf([Yup.ref('password')], 'Passwords must match'),
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

  const handleLogout = () => {
    auth.logOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <Link className="app-brand" to="/">Chat</Link>
      {auth.loggedIn && (
        <button className="logout-btn" onClick={handleLogout} type="button">
          Log out
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
    <div className="channel-menu" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-label="Channel manage"
        className="channel-menu-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        ▾
      </button>
      {open && (
        <div className="channel-menu-dropdown">
          <button
            onClick={() => {
              setOpen(false);
              onRename(channel.id);
            }}
            type="button"
          >
            Rename
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onRemove(channel.id);
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

const HomePage = () => {
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
    const socket = io();

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

    if (!messageText.trim() || !currentChannelId) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const response = await axios.post('/api/v1/messages', {
        body: messageText,
        channelId: currentChannelId,
        username: auth.username,
      }, {
        headers: { Authorization: `Bearer ${auth.token}` },
        timeout: 10000,
      });
      dispatch(addMessage(response.data));
      setMessageText('');
    } catch (err) {
      setSendError('Message was not delivered');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="chat-page">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="chat-page">
        <p className="error">{error}</p>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <aside className="channels">
        <div className="channels-header">
          <h2>Channels</h2>
          <button
            aria-label="Add channel"
            className="add-channel-btn"
            onClick={() => setModal({ type: 'add' })}
            type="button"
          >
            +
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
          <input
            aria-label="New message"
            disabled={sending}
            name="body"
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Enter message..."
            type="text"
            value={messageText}
          />
          <button disabled={sending || !messageText.trim()} type="submit">Send</button>
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
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (auth.loggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Log in</h1>
        <Formik
          initialValues={{ username: '', password: '' }}
          validationSchema={loginSchema}
          onSubmit={async (values, { setErrors, setSubmitting }) => {
            try {
              const response = await axios.post('/api/v1/login', values);
              auth.logIn(response.data);
              navigate(from, { replace: true });
            } catch (error) {
              setErrors({ auth: 'Invalid username or password' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, isSubmitting }) => (
            <Form className="form">
              <label htmlFor="username">Username</label>
              <Field id="username" name="username" type="text" />
              <ErrorMessage className="error" component="div" name="username" />

              <label htmlFor="password">Password</label>
              <Field id="password" name="password" type="password" />
              <ErrorMessage className="error" component="div" name="password" />

              {errors.auth && <div className="error">{errors.auth}</div>}
              <button disabled={isSubmitting} type="submit">Submit</button>
              <p className="auth-link">
                No account?
                {' '}
                <Link to="/signup">Registration</Link>
              </p>
            </Form>
          )}
        </Formik>
      </section>
    </main>
  );
};

const SignupPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.loggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Sign up</h1>
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
                setFieldError('username', 'This user already exists');
              } else {
                setFieldError('username', 'Registration failed');
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="form">
              <label htmlFor="signup-username">Username</label>
              <Field autoComplete="username" id="signup-username" name="username" type="text" />
              <ErrorMessage className="error" component="div" name="username" />

              <label htmlFor="signup-password">Password</label>
              <Field autoComplete="new-password" id="signup-password" name="password" type="password" />
              <ErrorMessage className="error" component="div" name="password" />

              <label htmlFor="signup-confirmPassword">Confirm password</label>
              <Field
                autoComplete="new-password"
                id="signup-confirmPassword"
                name="confirmPassword"
                type="password"
              />
              <ErrorMessage className="error" component="div" name="confirmPassword" />

              <button disabled={isSubmitting} type="submit">Submit</button>
              <p className="auth-link">
                Already have an account?
                {' '}
                <Link to="/login">Log in</Link>
              </p>
            </Form>
          )}
        </Formik>
      </section>
    </main>
  );
};

const NotFoundPage = () => (
  <main className="page">
    <section className="panel">
      <h1>404</h1>
      <p>Page not found.</p>
      <Link className="button" to="/">Go home</Link>
    </section>
  </main>
);

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
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
