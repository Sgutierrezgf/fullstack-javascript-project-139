import { configureStore, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchChatData = createAsyncThunk(
  'chat/fetchChatData',
  async (token) => {
    const headers = { Authorization: `Bearer ${token}` };
    const [channelsResponse, messagesResponse] = await Promise.all([
      axios.get('/api/v1/channels', { headers }),
      axios.get('/api/v1/messages', { headers }),
    ]);

    return {
      channels: channelsResponse.data,
      messages: messagesResponse.data,
    };
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    channels: [],
    messages: [],
    currentChannelId: null,
    defaultChannelId: null,
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentChannelId: (state, action) => {
      state.currentChannelId = action.payload;
    },
    addMessage: (state, action) => {
      const message = action.payload;
      const exists = state.messages.some(({ id }) => id === message.id);

      if (!exists) {
        state.messages.push(message);
      }
    },
    addChannel: (state, action) => {
      const channel = action.payload;
      const exists = state.channels.some(({ id }) => id === channel.id);

      if (!exists) {
        state.channels.push(channel);
      }
    },
    renameChannel: (state, action) => {
      const channel = state.channels.find(({ id }) => id === action.payload.id);

      if (channel) {
        channel.name = action.payload.name;
      }
    },
    removeChannel: (state, action) => {
      const channelId = action.payload.id;
      state.channels = state.channels.filter(({ id }) => id !== channelId);
      state.messages = state.messages.filter(
        ({ channelId: messageChannelId }) => String(messageChannelId) !== String(channelId),
      );

      if (String(state.currentChannelId) === String(channelId)) {
        state.currentChannelId = state.defaultChannelId;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChatData.fulfilled, (state, action) => {
        const { channels, messages } = action.payload;
        const defaultChannelId = channels.find(({ name }) => name === 'general')?.id
          ?? channels[0]?.id
          ?? null;

        state.channels = channels;
        state.messages = messages;
        state.defaultChannelId = defaultChannelId;
        state.currentChannelId = defaultChannelId;
        state.loading = false;
      })
      .addCase(fetchChatData.rejected, (state) => {
        state.loading = false;
        state.error = 'Failed to load chat data';
      });
  },
});

export const {
  addMessage,
  addChannel,
  renameChannel,
  removeChannel,
  setCurrentChannelId,
} = chatSlice.actions;

const store = configureStore({
  reducer: {
    chat: chatSlice.reducer,
  },
});

export default store;
