import { useEffect, useMemo, useRef, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import * as Yup from 'yup';
import { addChannel, renameChannel, removeChannel, setCurrentChannelId } from '../store';

const getChannelNameSchema = (channels, currentName = '') => Yup.object({
  name: Yup.string()
    .trim()
    .required('Required')
    .min(3, 'From 3 to 20 characters')
    .max(20, 'From 3 to 20 characters')
    .notOneOf(
      channels
        .map(({ name }) => name)
        .filter((name) => name !== currentName),
      'Must be unique',
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
  const inputRef = useRef(null);
  const validationSchema = useMemo(
    () => getChannelNameSchema(channels, initialName),
    [channels, initialName],
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
          <button aria-label="Close" className="modal-close" onClick={onHide} type="button">
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
              <label className="visually-hidden" htmlFor="channelName">Channel name</label>
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
                  Cancel
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
      setStatus('Failed to remove channel');
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
          <h2>Remove channel</h2>
          <button aria-label="Close" className="modal-close" onClick={onHide} type="button">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={handleRemove}>
          <p>Are you sure?</p>
          {status && <div className="error">{status}</div>}
          <div className="modal-actions">
            <button disabled={submitting} onClick={onHide} type="button">
              Cancel
            </button>
            <button
              className="danger"
              disabled={submitting}
              ref={confirmRef}
              type="submit"
            >
              Remove
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
            setFieldError('name', 'Network error');
          } finally {
            setSubmitting(false);
          }
        }}
        submitLabel="Submit"
        title="Add channel"
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
            setFieldError('name', 'Network error');
          } finally {
            setSubmitting(false);
          }
        }}
        submitLabel="Submit"
        title="Rename channel"
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
