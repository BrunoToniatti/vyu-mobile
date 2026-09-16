import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../App';
import { ChatMessage } from '../types';
import { getChatMessages, sendChatMessage } from '../services/chat';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
};

const POLL_INTERVAL = 4000;

function useCountdown(targetIso: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!targetIso) return;
    function tick() {
      const diff = Math.max(0, Math.floor((new Date(targetIso!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return { secondsLeft, label };
}

export default function ChatScreen({ navigation, route }: Props) {
  const { restaurant } = route.params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextResetAt, setNextResetAt] = useState<string | null>(null);
  const lastIdRef = useRef<number | undefined>(undefined);
  const flatListRef = useRef<FlatList>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { secondsLeft, label: countdownLabel } = useCountdown(nextResetAt);

  // When countdown hits 0, trigger a full reload
  const prevSecondsRef = useRef(secondsLeft);
  useEffect(() => {
    if (prevSecondsRef.current > 0 && secondsLeft === 0 && !loading) {
      lastIdRef.current = undefined;
      loadInitial();
    }
    prevSecondsRef.current = secondsLeft;
  }, [secondsLeft]);

  const loadInitial = useCallback(async () => {
    try {
      const res = await getChatMessages(restaurant.id);
      setMessages(res.messages);
      if (res.messages.length > 0) {
        lastIdRef.current = res.messages[res.messages.length - 1].id;
      }
      if (res.nextResetAt) setNextResetAt(res.nextResetAt);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

  const poll = useCallback(async () => {
    try {
      const res = await getChatMessages(restaurant.id, lastIdRef.current);
      if (res.nextResetAt) setNextResetAt(res.nextResetAt);
      if (res.wasReset) {
        setMessages(res.messages);
        lastIdRef.current = res.messages.length > 0 ? res.messages[res.messages.length - 1].id : undefined;
        return;
      }
      if (res.messages.length > 0) {
        setMessages((prev) => [...prev, ...res.messages]);
        lastIdRef.current = res.messages[res.messages.length - 1].id;
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_) {}
  }, [restaurant.id]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!loading) {
      intervalRef.current = setInterval(poll, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading, poll]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await sendChatMessage(restaurant.id, trimmed);
      setMessages((prev) => [...prev, msg]);
      lastIdRef.current = msg.id;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (_) {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isRestaurant = item.sender_type === 'restaurant';

    return (
      <View style={[styles.msgRow, isRestaurant && styles.msgRowRestaurant]}>
        {!isRestaurant && (
          <View style={styles.avatar}>
            {item.sender_photo ? (
              <Image source={{ uri: item.sender_photo }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>
                {item.sender_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            )}
          </View>
        )}
        <View style={[styles.bubble, isRestaurant ? styles.bubbleRestaurant : styles.bubbleUser]}>
          <Text style={[styles.senderName, isRestaurant && styles.senderNameRestaurant]}>
            {isRestaurant ? restaurant.name : item.sender_name}
          </Text>
          <Text style={[styles.msgText, isRestaurant && styles.msgTextRestaurant]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, isRestaurant && styles.msgTimeRestaurant]}>
            {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isRestaurant && (
          <View style={[styles.avatar, styles.avatarRestaurant]}>
            {restaurant.photo_url ? (
              <Image source={{ uri: restaurant.photo_url }} style={styles.avatarImg} />
            ) : (
              <MaterialIcons name="restaurant" size={18} color="#fff" />
            )}
          </View>
        )}
      </View>
    );
  }

  const isNearReset = secondsLeft > 0 && secondsLeft <= 300; // last 5 min → warn

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{restaurant.name}</Text>
          <Text style={styles.headerSub}>Chat público</Text>
        </View>
        {nextResetAt && secondsLeft > 0 && (
          <View style={[styles.timerBadge, isNearReset && styles.timerBadgeWarn]}>
            <MaterialIcons name="timer" size={13} color={isNearReset ? '#fff' : 'rgba(255,255,255,0.85)'} />
            <Text style={[styles.timerText, isNearReset && styles.timerTextWarn]}>{countdownLabel}</Text>
          </View>
        )}
      </View>

      {nextResetAt && secondsLeft > 0 && (
        <View style={[styles.resetBanner, isNearReset && styles.resetBannerWarn]}>
          <MaterialIcons name="autorenew" size={14} color={isNearReset ? '#b71c1c' : '#5c6bc0'} />
          <Text style={[styles.resetBannerText, isNearReset && styles.resetBannerTextWarn]}>
            {isNearReset
              ? `⚠️ Chat reseta em ${countdownLabel}`
              : `Chat reseta em ${countdownLabel}`}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1a237e" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialIcons name="chat-bubble-outline" size={48} color="#bbb" />
                <Text style={styles.emptyText}>Nenhuma mensagem ainda.{'\n'}Seja o primeiro a falar!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Digite uma mensagem..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a237e' },
  flex: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1a237e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  timerBadgeWarn: {
    backgroundColor: '#e53935',
    borderColor: '#ef9a9a',
  },
  timerText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerTextWarn: { color: '#fff' },

  resetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#c5cae9',
  },
  resetBannerWarn: {
    backgroundColor: '#ffebee',
    borderBottomColor: '#ef9a9a',
  },
  resetBannerText: { fontSize: 12, color: '#3949ab', fontWeight: '600', flex: 1 },
  resetBannerTextWarn: { color: '#c62828' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 8 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 22 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  msgRowRestaurant: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1a237e',
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 6,
  },
  avatarRestaurant: { backgroundColor: '#e91e63' },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 13 },

  bubble: {
    maxWidth: '72%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleUser: { borderBottomLeftRadius: 4 },
  bubbleRestaurant: { backgroundColor: '#1a237e', borderBottomRightRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: '#1a237e', marginBottom: 2 },
  senderNameRestaurant: { color: 'rgba(255,255,255,0.8)' },
  msgText: { fontSize: 14, color: '#222', lineHeight: 20 },
  msgTextRestaurant: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#999', marginTop: 4, alignSelf: 'flex-end' },
  msgTimeRestaurant: { color: 'rgba(255,255,255,0.6)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#222',
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1a237e',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#b0bec5' },
});
