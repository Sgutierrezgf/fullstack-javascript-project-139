import { useEffect, useMemo, useRef, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as Yup from 'yup';
import { addChannel, renameChannel, removeChannel, setCurrentChannelId } from '../store';

const getChannelNameSchema = (t, channels, currentName = '') => Yup.object({
  name: Yup.string()
    .trim()
    .required(t('validation.required'))
    .min(3, t('validation.channelNameLength'))
    .max(20, t('validation.channelNameLength'))
    .notOneOf(
      channels
        .map(({ name }) => name)
        .filter((name) => name !== currentName),
      t('validation.mustBeUnique'),
    ),
});

const ChannelNameModal = ({
  title,
  submitLabel,
  initialName = '',
  channels,
  onHide,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const validationSchema = useMemo(
    () => getChannelNameSchema(t, channels, initialName),
    [t, channels, initialName],
  );

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);
  }, []);

  return (
    <div className="modal-backdrop" onClick={onHide} role="presentation">
      <div
        aria-modal="true"
        className="modal-window"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label={t('close')} className="modal-close" onClick={onHide} type="button">
            ×
          </button>
        </div>
        <Formik
          enableReinitialize
          initialValues={{ name: initialName }}
          onSubmit={onSubmit}
          validationSchema={validationSchema}
        >
          {({ isSubmitting }) => (
            <Form className="modal-form">
              <label className="visually-hidden" htmlFor="channelName">{t('channelName')}</label>
              <Field name="name">
                {({ field }) => (
                  <input
                    {...field}
                    disabled={isSubmitting}
                    id="channelName"
                    ref={inputRef}
                    type="text"
                  />
                )}
              </Field>
              <ErrorMessage className="error" component="div" name="name" />
              <div className="modal-actions">
                <button disabled={isSubmitting} onClick={onHide} type="button">
                  {t('cancel')}
                </button>
                <button disabled={isSubmitting} type="submit">
                  {submitLabel}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

const RemoveChannelModal = ({
  channel,
  token,
  onHide,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const confirmRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setTimeout(() => confirmRef.current?.focus(), 0);
  }, []);

  const handleRemove = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      await axios.delete(`/api/v1/channels/${channel.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      dispatch(removeChannel({ id: channel.id }));
      onHide();
    } catch (error) {
      setStatus(t('removeChannelFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onHide} role="presentation">
      <div
        aria-modal="true"
        className="modal-window"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <h2>{t('removeChannelTitle')}</h2>
          <button aria-label={t('close')} className="modal-close" onClick={onHide} type="button">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={handleRemove}>
          <p>{t('areYouSure')}</p>
          {status && <div className="error">{status}</div>}
          <div className="modal-actions">
            <button disabled={submitting} onClick={onHide} type="button">
              {t('cancel')}
            </button>
            <button
              className="danger"
              disabled={submitting}
              ref={confirmRef}
              type="submit"
            >
              {t('remove')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ChannelModals = ({
  modal,
  token,
  onHide,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const channels = useSelector((state) => state.chat.channels);
  const channel = channels.find(({ id }) => id === modal?.channelId);

  if (!modal) {
    return null;
  }

  if (modal.type === 'add') {
    return (
      <ChannelNameModal
        channels={channels}
        onHide={onHide}
        onSubmit={async ({ name }, { setSubmitting, setFieldError }) => {
          try {
            const response = await axios.post('/api/v1/channels', { name: name.trim() }, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            });
            dispatch(addChannel(response.data));
            dispatch(setCurrentChannelId(response.data.id));
            onHide();
          } catch (error) {
            setFieldError('name', t('networkError'));
          } finally {
            setSubmitting(false);
          }
        }}
        submitLabel={t('submit')}
        title={t('addChannelTitle')}
      />
    );
  }

  if (modal.type === 'rename' && channel) {
    return (
      <ChannelNameModal
        channels={channels}
        initialName={channel.name}
        onHide={onHide}
        onSubmit={async ({ name }, { setSubmitting, setFieldError }) => {
          try {
            const response = await axios.patch(`/api/v1/channels/${channel.id}`, {
              name: name.trim(),
            }, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            });
            dispatch(renameChannel(response.data));
            onHide();
          } catch (error) {
            setFieldError('name', t('networkError'));
          } finally {
            setSubmitting(false);
          }
        }}
        submitLabel={t('submit')}
        title={t('renameChannelTitle')}
      />
    );
  }

  if (modal.type === 'remove' && channel) {
    return (
      <RemoveChannelModal
        channel={channel}
        onHide={onHide}
        token={token}
      />
    );
  }

  return null;
};

export default ChannelModals;
