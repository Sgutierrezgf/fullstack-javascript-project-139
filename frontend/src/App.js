import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
import './App.css';
import { addMessage, fetchChatData } from './store';

const AuthContext = createContext(null);

const loginSchema = Yup.object({
  username: Yup.string().required('Required'),
  password: Yup.string().required('Required'),
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

  const value = useMemo(() => ({
    token,
    username,
    loggedIn: Boolean(token),
    logIn,
  }), [token, username]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
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
  const currentMessages = messages.filter((message) => message.channelId === currentChannelId);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    dispatch(fetchChatData(auth.token));
  }, [auth.token, dispatch]);

  useEffect(() => {
    const socket = io();

    socket.on('newMessage', (message) => {
      dispatch(addMessage(message));
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
      await axios.post('/api/v1/messages', {
        body: messageText,
        channelId: currentChannelId,
        username: auth.username,
      }, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
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
        <h2>Channels</h2>
        <ul>
          {channels.map((channel) => (
            <li key={channel.id}>{channel.name}</li>
          ))}
        </ul>
      </aside>
      <section className="chat">
        <div className="messages">
          {currentMessages.map((message) => (
            <p key={message.id}>
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
            type="text"
            value={messageText}
          />
          <button disabled={sending} type="submit">Send</button>
          {sendError && <span className="error">{sendError}</span>}
        </form>
      </section>
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
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
