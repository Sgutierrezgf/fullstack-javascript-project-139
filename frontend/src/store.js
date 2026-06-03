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
    loading: false,
    error: null,
  },
  reducers: {
    addMessage: (state, action) => {
      const message = action.payload;
      const exists = state.messages.some(({ id }) => id === message.id);

      if (!exists) {
        state.messages.push(message);
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

        state.channels = channels;
        state.messages = messages;
        state.currentChannelId = channels.find(({ name }) => name === 'general')?.id ?? channels[0]?.id ?? null;
        state.loading = false;
      })
      .addCase(fetchChatData.rejected, (state) => {
        state.loading = false;
        state.error = 'Failed to load chat data';
      });
  },
});

export const { addMessage } = chatSlice.actions;

const store = configureStore({
  reducer: {
    chat: chatSlice.reducer,
  },
});

export default store;
