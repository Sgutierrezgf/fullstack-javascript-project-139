import { useEffect, useMemo, useRef, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import axios from 'axios';
import * as Yup from 'yup';
import { addChannel, renameChannel, removeChannel, setCurrentChannelId } from '../store';
import { cleanProfanity } from '../utils/profanity';

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
                    aria-label={t('channelName')}
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
    event?.preventDefault?.();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      await axios.delete(`/api/v1/channels/${channel.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      dispatch(removeChannel({ id: channel.id }));
      toast.success(t('channelRemoved'));
      onHide();
    } catch (error) {
      setStatus(t('removeChannelFailed'));
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop modal fade show" onClick={onHide} role="presentation" style={{ display: 'flex' }}>
      <div
        aria-modal="true"
        className="modal-window modal-dialog modal-dialog-centered"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">{t('removeChannelTitle')}</h2>
            <button aria-label={t('close')} className="modal-close btn-close" onClick={onHide} type="button">
              ×
            </button>
          </div>
          <div className="modal-body">
            <p>{t('areYouSure')}</p>
            {status && <div className="error">{status}</div>}
          </div>
          <div className="modal-actions modal-footer">
            <button
              className="btn btn-secondary"
              disabled={submitting}
              onClick={onHide}
              type="button"
            >
              {t('cancel')}
            </button>
            <button
              className="danger btn btn-danger"
              disabled={submitting}
              onClick={handleRemove}
              ref={confirmRef}
              type="button"
            >
              {t('remove')}
            </button>
          </div>
        </div>
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
            const response = await axios.post('/api/v1/channels', {
              name: cleanProfanity(name.trim()),
            }, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            });
            dispatch(addChannel(response.data));
            dispatch(setCurrentChannelId(response.data.id));
            toast.success(t('channelCreated'));
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
              name: cleanProfanity(name.trim()),
            }, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            });
            dispatch(renameChannel(response.data));
            toast.success(t('channelRenamed'));
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
