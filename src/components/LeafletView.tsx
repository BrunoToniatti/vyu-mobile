import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

export type LeafletHandle = { command: (cmd: Record<string, unknown>) => void };

type Props = {
  html: string;
  onMessage?: (data: any) => void;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
};

/**
 * Leaflet page host. Native: WebView. Web: iframe (react-native-webview has no web build).
 * The page talks back through `send()` and receives commands in `handleCommand()`.
 */
const LeafletView = forwardRef<LeafletHandle, Props>(function LeafletView({ html, onMessage, style, interactive = true }, ref) {
  const webRef = useRef<any>(null);
  const frameRef = useRef<any>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useImperativeHandle(ref, () => ({
    command(cmd) {
      const json = JSON.stringify(cmd);
      if (Platform.OS === 'web') frameRef.current?.contentWindow?.postMessage(json, '*');
      else webRef.current?.injectJavaScript(`window.handleCommand && window.handleCommand(${json}); true;`);
    },
  }));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      try { onMessageRef.current?.(JSON.parse(String(e.data))); } catch { /* ignore */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.base, style]} pointerEvents={interactive ? 'auto' : 'none'}>
        {React.createElement('iframe', {
          ref: frameRef,
          srcDoc: html,
          title: 'map',
          style: { border: 0, width: '100%', height: '100%', display: 'block', background: colors.void },
        })}
      </View>
    );
  }

  return (
    <View style={[styles.base, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: colors.void }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled={false}
        startInLoadingState
        onMessage={(e) => {
          try { onMessageRef.current?.(JSON.parse(e.nativeEvent.data)); } catch { /* ignore */ }
        }}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.loading]}>
            <ActivityIndicator color={colors.cyan} />
          </View>
        )}
      />
    </View>
  );
});

export default LeafletView;

/** Shared head: Leaflet, dark theme and the bridge helpers. */
export const LEAFLET_HEAD = `
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#0A0617}
  .leaflet-container{background:#0A0617;font-family:-apple-system,Inter,sans-serif}
  /* keyless OSM tiles, recoloured to the dark VYU look */
  .leaflet-tile-pane{filter:invert(1) hue-rotate(200deg) saturate(.55) brightness(.82) contrast(.92)}
  .leaflet-control-attribution{background:rgba(10,6,23,.6)!important;color:rgba(255,255,255,.4)!important;font-size:9px}
  .leaflet-control-attribution a{color:rgba(100,235,226,.6)!important}
  .pin{position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center}
  .pin .core{width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 16px var(--c),0 0 4px var(--c);background:var(--c);transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
  .pin .wave{position:absolute;inset:8px;border-radius:50%;border:2px solid var(--c);animation:wave 1.8s ease-out infinite;opacity:0}
  .pin .wave.b{animation-delay:.9s}
  .pin.active .core{transform:scale(1.5)}
  .me .core{width:16px;height:16px;background:#64EBE2;--c:#64EBE2}
  @keyframes wave{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.9);opacity:0}}
</style>
<script>
  function send(o){var s=JSON.stringify(o);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else if(window.parent&&window.parent!==window){window.parent.postMessage(s,'*')}}
  window.addEventListener('message',function(e){try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;window.handleCommand&&window.handleCommand(d)}catch(_){}});
  function pinHtml(color,extra){return '<div class="pin '+(extra||'')+'" style="--c:'+color+'"><div class="wave"></div><div class="wave b"></div><div class="core"></div></div>'}
  var DARK_TILES='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
</script>`;

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.void },
  loading: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.void },
});
