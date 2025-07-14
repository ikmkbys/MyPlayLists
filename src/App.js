import React from 'react';

function App() {
  let firebaseConfigString = null;
  let configSource = "未定義";

  // Safely check for different environments
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FIREBASE_CONFIG) {
    // This branch is for Netlify build environment
    firebaseConfigString = process.env.REACT_APP_FIREBASE_CONFIG;
    configSource = "Netlify (process.env)";
  } else if (typeof window !== 'undefined' && window.__firebase_config) {
    // This branch is for the local dev/preview environment
    // Note: The value might be a placeholder string from the HTML template
    firebaseConfigString = window.__firebase_config;
    configSource = "開発環境 (window)";
  }

  const variableType = typeof firebaseConfigString;
  const isDefined = firebaseConfigString !== undefined && firebaseConfigString !== null;
  const isNull = firebaseConfigString === null;
  const isPlaceholder = firebaseConfigString === '__FIREBASE_CONFIG_PLACEHOLDER__';

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', lineHeight: '1.6', color: '#333' }}>
      <h1 style={{ fontSize: '2rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>環境変数デバッグ情報</h1>
      <p>このページは問題解決のための一時的な表示です。</p>
      
      <div style={{ marginTop: '2rem', backgroundColor: '#f9f9f9', border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111' }}><code>REACT_APP_FIREBASE_CONFIG</code> の状態:</h2>
        
        <p><strong>設定ソース:</strong> <span style={{ fontWeight: 'bold' }}>{configSource}</span></p>
        <p><strong>定義されていますか？ (isDefined):</strong> <span style={{ fontWeight: 'bold' }}>{isDefined ? 'はい' : 'いいえ'}</span></p>
        <p><strong>nullですか？ (isNull):</strong> <span style={{ fontWeight: 'bold' }}>{isNull ? 'はい' : 'いいえ'}</span></p>
        <p><strong>変数の型 (typeof):</strong> <span style={{ fontWeight: 'bold' }}>{variableType}</span></p>
        <p><strong>プレースホルダーのままですか？ (isPlaceholder):</strong> <span style={{ fontWeight: 'bold' }}>{isPlaceholder ? 'はい' : 'いいえ'}</span></p>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111' }}>変数の内容:</h2>
        <pre style={{ backgroundColor: '#f0f0f0', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '400px', overflowY: 'auto' }}>
          {firebaseConfigString || "変数が空か、定義されていません。"}
        </pre>
      </div>
    </div>
  );
}

export default App;
