import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    writeBatch,
    setDoc,
    updateDoc,
    getDoc,
    getDocs,
    where,
    arrayRemove
} from 'firebase/firestore';
import { Plus, Trash2, ListMusic, Link as LinkIcon, Loader2, Edit, Check, X, GripVertical, Share2, Copy, Waves, AlertTriangle, Inbox, Search, Move, LogIn, LogOut, Mail, Shield } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-my-playlists-app';

// --- Helper Functions ---
const detectPlatform = (url) => {
    if (url.includes('voicy.jp') || url.includes('r.voicy.jp')) return 'Voicy';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('spotify.com')) return 'Spotify';
    if (url.includes('stand.fm')) return 'stand.fm';
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return domain;
    } catch (e) {
        return 'Web';
    }
};

const getPlatformStyle = (platform) => {
    const p = platform ? platform.toLowerCase() : '';
    if (p.includes('voicy')) return 'bg-orange-100 text-orange-800';
    if (p.includes('youtube')) return 'bg-red-100 text-red-800';
    if (p.includes('spotify')) return 'bg-green-100 text-green-800';
    if (p.includes('stand.fm')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-slate-200 text-slate-600';
};

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [firebaseError, setFirebaseError] = useState(null);

    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [contents, setContents] = useState([]);
    const [personalities, setPersonalities] = useState([]);
    const [allTags, setAllTags] = useState([]);
    
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistTags, setNewPlaylistTags] = useState('');
    const [newContentUrl, setNewContentUrl] = useState('');
    const [newContentTitle, setNewContentTitle] = useState('');
    const [newContentAuthor, setNewContentAuthor] = useState('');
    const [contentFormError, setContentFormError] = useState('');

    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
    const [isLoadingContents, setIsLoadingContents] = useState(false);
    
    const [isEditingPlaylistName, setIsEditingPlaylistName] = useState(false);
    const [editingPlaylistData, setEditingPlaylistData] = useState({ name: '', tags: '' });
    
    const [editingContentId, setEditingContentId] = useState(null);
    const [editingContentData, setEditingContentData] = useState({ url: '', title: '', author: '', platform: '' });
    
    const [activeFilterTags, setActiveFilterTags] = useState([]);
    const [isManagingTags, setIsManagingTags] = useState(false);

    // New Feature States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeView, setActiveView] = useState('playlist'); // 'playlist', 'search'
    const [inboxContents, setInboxContents] = useState([]);
    const [showMoveMenu, setShowMoveMenu] = useState(null); // content.id to show move menu

    // --- Modal States ---
    const [shareMode, setShareMode] = useState(false);
    const [sharedPlaylistData, setSharedPlaylistData] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [playlistToShare, setPlaylistToShare] = useState(null);
    const [shareLink, setShareLink] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [confirmDeleteInfo, setConfirmDeleteInfo] = useState(null);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    const newPlaylistInputRef = useRef(null);
    const newContentUrlInputRef = useRef(null);
    const draggedItem = useRef(null);

    // --- Firebase & Auth & Share-Mode Initialization ---
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey) {
                const app = initializeApp(firebaseConfig);
                const authInstance = getAuth(app);
                const dbInstance = getFirestore(app);
                
                setAuth(authInstance);
                setDb(dbInstance);

                const urlParams = new URLSearchParams(window.location.search);
                const shareUser = urlParams.get('share_user');
                const sharePlaylist = urlParams.get('share_playlist');

                if (shareUser && sharePlaylist && dbInstance) {
                    setShareMode(true);
                    setIsLoadingPlaylists(true);
                    const fetchSharedPlaylist = async () => {
                        try {
                            const playlistRef = doc(dbInstance, `artifacts/${appId}/users/${shareUser}/playlists`, sharePlaylist);
                            const playlistSnap = await getDoc(playlistRef);
                            if (playlistSnap.exists() && playlistSnap.data().isPublic) {
                                const playlistData = { id: playlistSnap.id, ...playlistSnap.data() };
                                setSharedPlaylistData(playlistData);
                                setSelectedPlaylist(playlistData);
                            } else {
                                setSharedPlaylistData(null);
                            }
                        } catch (error) { console.error("Error fetching shared playlist:", error);
                        } finally { setIsLoadingPlaylists(false); }
                    };
                    fetchSharedPlaylist();
                } else {
                    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                        setUser(user);
                        setIsAuthReady(true);
                    });
                    return () => unsubscribe();
                }
            } else {
                setFirebaseError("Firebaseの設定が読み込めませんでした。");
                setIsAuthReady(true);
            }
        } catch (error) {
            console.error("Firebase initialization error:", error);
            setFirebaseError(`Firebaseの初期化に失敗しました: ${error.message}`);
            setIsAuthReady(true);
        }
    }, []);

    // --- Data Fetching (Normal Mode) ---
    useEffect(() => {
        if (shareMode || !isAuthReady || !db || !user) return;
        setIsLoadingPlaylists(true);
        const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/playlists`), orderBy('position', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoadingPlaylists(false);
        }, (error) => { setIsLoadingPlaylists(false); });
        return () => unsubscribe();
    }, [isAuthReady, db, user, shareMode]);

    useEffect(() => {
        if (shareMode || !isAuthReady || !db || !user) return;
        const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/tags`), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllTags(snapshot.docs.map(doc => doc.data().name));
        });
        return () => unsubscribe();
    }, [isAuthReady, db, user, shareMode]);


    // --- Data Fetching: Contents (Both Modes) ---
    useEffect(() => {
        if (!selectedPlaylist || !db) { setContents([]); return; }
        const ownerId = shareMode ? new URLSearchParams(window.location.search).get('share_user') : user?.uid;
        if (!ownerId) return;
        
        const isInbox = selectedPlaylist.id === 'inbox';
        const collectionName = isInbox ? 'inbox' : `playlists/${selectedPlaylist.id}/contents`;

        setIsLoadingContents(true);
        const q = query(collection(db, `artifacts/${appId}/users/${ownerId}/${collectionName}`), isInbox ? orderBy('addedAt', 'desc') : orderBy('position', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (isInbox) {
                setInboxContents(data);
            } else {
                setContents(data);
            }
            setIsLoadingContents(false);
        }, (error) => { setIsLoadingContents(false); });
        return () => unsubscribe();
    }, [selectedPlaylist, db, user, shareMode]);

    // --- Data Fetching: Authors (Normal Mode) ---
    useEffect(() => {
        if (shareMode || !isAuthReady || !db || !user) return;
        const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/authors`), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPersonalities(snapshot.docs.map(doc => doc.data().name));
        });
        return () => unsubscribe();
    }, [isAuthReady, db, user, shareMode]);

    // --- Auth Handlers ---
    const handleGoogleLogin = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google login failed:", error);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setPlaylists([]);
            setSelectedPlaylist(null);
            setContents([]);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    // --- Tag Management ---
    const updateTagsCollection = async (tagsArray) => {
        if (!db || !user) return;
        const tagsRef = collection(db, `artifacts/${appId}/users/${user.uid}/tags`);
        const querySnapshot = await getDocs(tagsRef);
        const existingTags = querySnapshot.docs.map(doc => doc.id);
        const batch = writeBatch(db);
        tagsArray.forEach(tag => {
            if (tag && !existingTags.includes(tag)) {
                batch.set(doc(tagsRef, tag), { name: tag });
            }
        });
        await batch.commit();
    };

    // --- Playlist Handlers ---
    const handleCreatePlaylist = async (e) => {
        e.preventDefault();
        if (shareMode || !db || !user || newPlaylistName.trim() === '') return;
        const tagsArray = newPlaylistTags.split(',').map(tag => tag.trim()).filter(Boolean);
        const finalTags = tagsArray.length > 0 ? tagsArray : ['タグ無し'];

        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/playlists`), {
                name: newPlaylistName.trim(), 
                tags: finalTags,
                createdAt: serverTimestamp(), 
                position: playlists.length, 
                isPublic: false
            });
            await updateTagsCollection(finalTags);
            setNewPlaylistName('');
            setNewPlaylistTags('');
            newPlaylistInputRef.current?.focus();
        } catch (error) { console.error("Error creating playlist:", error); }
    };

    const requestDeletePlaylist = (playlist) => {
        setConfirmDeleteInfo({ type: 'playlist', id: playlist.id, name: playlist.name });
    };

    const handleStartEditingPlaylist = () => {
        if (!selectedPlaylist) return;
        setIsEditingPlaylistName(true);
        setEditingPlaylistData({
            name: selectedPlaylist.name,
            tags: (selectedPlaylist.tags || []).join(', ')
        });
    };
    const handleCancelEditingPlaylist = () => {
        setIsEditingPlaylistName(false);
        setEditingPlaylistData({ name: '', tags: '' });
    };
    const handleSavePlaylistName = async () => {
        if (shareMode || !db || !user || !selectedPlaylist || editingPlaylistData.name.trim() === '') return;
        const tagsArray = editingPlaylistData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        const finalTags = tagsArray.length > 0 ? tagsArray : ['タグ無し'];
        
        try {
            await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/playlists`, selectedPlaylist.id), { 
                name: editingPlaylistData.name.trim(),
                tags: finalTags
            });
            await updateTagsCollection(finalTags);
            handleCancelEditingPlaylist();
        } catch (error) { console.error("Error updating playlist name:", error); }
    };
    
    const handlePlaylistDragAndDrop = async (newOrder) => {
        if (shareMode || !db || !user) return;
        const batch = writeBatch(db);
        newOrder.forEach((p, i) => batch.update(doc(db, `artifacts/${appId}/users/${user.uid}/playlists`, p.id), { position: i }));
        try { await batch.commit(); } catch (error) { setPlaylists(playlists); }
    };

    // --- Content Handlers ---
    const handleAddContent = async (e) => {
        e.preventDefault();
        setContentFormError('');
        if (shareMode || !db || !user || !selectedPlaylist) return;
        const url = newContentUrl.trim();
        if (url === '') { setContentFormError('URLは必須です。'); return; }
        if (!url.startsWith('http')) { setContentFormError('有効なURLを入力してください (http://...)'); return; }
        
        const author = newContentAuthor.trim();
        const platform = detectPlatform(url);

        const contentData = {
            url: url, 
            title: newContentTitle.trim() || "タイトル未設定", 
            author: author || "作者未設定", 
            platform: platform,
            addedAt: serverTimestamp(), 
        };

        try {
            const targetCollection = selectedPlaylist.id === 'inbox' 
                ? `inbox` 
                : `playlists/${selectedPlaylist.id}/contents`;
            
            if (selectedPlaylist.id !== 'inbox') {
                contentData.position = contents.length;
            }

            await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/${targetCollection}`), contentData);
            
            if (author && !personalities.includes(author)) {
                await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/authors`, author), { name: author });
            }
            setNewContentUrl(''); setNewContentTitle(''); setNewContentAuthor(''); setContentFormError('');
            newContentUrlInputRef.current?.focus();
        } catch (error) { console.error("Error adding content:", error); }
    };

    const requestDeleteContent = (content) => {
        setConfirmDeleteInfo({ type: 'content', id: content.id, name: content.title });
    };
    
    const handleStartEditingContent = (content) => {
        setEditingContentId(content.id);
        setEditingContentData({ url: content.url, title: content.title, author: content.author, platform: content.platform });
    };
    const handleCancelEditingContent = () => {
        setEditingContentId(null);
        setEditingContentData({ url: '', title: '', author: '', platform: '' });
    };
    const handleSaveContent = async (contentId) => {
        if (shareMode || !db || !user || !selectedPlaylist) return;
        const platform = detectPlatform(editingContentData.url);
        const collectionName = selectedPlaylist.id === 'inbox' ? 'inbox' : `playlists/${selectedPlaylist.id}/contents`;
        try {
            await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/${collectionName}`, contentId), {...editingContentData, platform});
            handleCancelEditingContent();
        } catch (error) { console.error("Error updating content:", error); }
    };

    const handleContentDragAndDrop = async (newOrder) => {
        if (shareMode || !db || !user || !selectedPlaylist || selectedPlaylist.id === 'inbox') return;
        const batch = writeBatch(db);
        newOrder.forEach((b, i) => batch.update(doc(db, `artifacts/${appId}/users/${user.uid}/playlists/${selectedPlaylist.id}/contents`, b.id), { position: i }));
        try { await batch.commit(); } catch (error) { setContents(contents); }
    };
    
    const handleMoveContent = async (contentToMove, targetPlaylistId) => {
        if (!db || !user || !selectedPlaylist) return;
    
        const sourceIsInbox = selectedPlaylist.id === 'inbox';
        const sourceCollectionPath = sourceIsInbox 
            ? `inbox` 
            : `playlists/${selectedPlaylist.id}/contents`;
    
        const targetIsInbox = targetPlaylistId === 'inbox';
        const targetCollectionPath = targetIsInbox
            ? `inbox`
            : `playlists/${targetPlaylistId}/contents`;
    
        const batch = writeBatch(db);
    
        const newContentData = { ...contentToMove };
        delete newContentData.id; 
    
        if (targetIsInbox) {
            delete newContentData.position;
            newContentData.addedAt = serverTimestamp();
        } else {
            const targetContentsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${user.uid}/${targetCollectionPath}`));
            newContentData.position = targetContentsSnapshot.size;
        }
        
        const newContentRef = doc(collection(db, `artifacts/${appId}/users/${user.uid}/${targetCollectionPath}`));
        batch.set(newContentRef, newContentData);
    
        const oldContentRef = doc(db, `artifacts/${appId}/users/${user.uid}/${sourceCollectionPath}`, contentToMove.id);
        batch.delete(oldContentRef);
    
        try {
            await batch.commit();
            setShowMoveMenu(null);
        } catch (error) {
            console.error("Error moving content:", error);
        }
    };


    // --- Universal Delete Handler ---
    const handleConfirmDelete = async () => {
        if (!confirmDeleteInfo) return;
        const { type, id, name } = confirmDeleteInfo;
        
        if (type === 'playlist') {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/playlists`, id));
                if (selectedPlaylist?.id === id) {
                    setSelectedPlaylist(null);
                }
            } catch (error) { console.error("Error deleting playlist:", error); }
        } else if (type === 'content') {
            const collectionName = selectedPlaylist.id === 'inbox' ? 'inbox' : `playlists/${selectedPlaylist.id}/contents`;
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/${collectionName}`, id));
            } catch (error) { console.error("Error deleting content:", error); }
        } else if (type === 'tag') {
            try {
                const batch = writeBatch(db);
                const tagRef = doc(db, `artifacts/${appId}/users/${user.uid}/tags`, name);
                batch.delete(tagRef);

                const playlistsQuery = query(collection(db, `artifacts/${appId}/users/${user.uid}/playlists`), where("tags", "array-contains", name));
                const playlistsSnapshot = await getDocs(playlistsQuery);
                playlistsSnapshot.forEach(playlistDoc => {
                    const playlistRef = doc(db, `artifacts/${appId}/users/${user.uid}/playlists`, playlistDoc.id);
                    const currentTags = playlistDoc.data().tags || [];
                    if (currentTags.length === 1 && currentTags[0] === name) {
                         batch.update(playlistRef, { tags: ['タグ無し'] });
                    } else {
                         batch.update(playlistRef, { tags: arrayRemove(name) });
                    }
                });
                await batch.commit();
            } catch (error) {
                console.error("Error deleting tag:", error);
            }
        }
        setConfirmDeleteInfo(null);
    };
    
    const requestDeleteTag = (tag) => {
        setConfirmDeleteInfo({ type: 'tag', id: tag, name: tag });
    };

    // --- Search Logic ---
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setActiveView('playlist');
            return;
        }
        
        setIsSearching(true);
        setActiveView('search');
        setSearchResults([]);

        const allPlaylistsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${user.uid}/playlists`));
        const allContentsPromises = [];

        allPlaylistsSnapshot.forEach(playlistDoc => {
            const contentsPromise = getDocs(collection(db, `artifacts/${appId}/users/${user.uid}/playlists/${playlistDoc.id}/contents`));
            allContentsPromises.push(contentsPromise.then(snapshot => ({
                playlistName: playlistDoc.data().name,
                playlistId: playlistDoc.id,
                contents: snapshot.docs.map(d => ({...d.data(), id: d.id}))
            })));
        });
        
        const inboxPromise = getDocs(collection(db, `artifacts/${appId}/users/${user.uid}/inbox`));
        allContentsPromises.push(inboxPromise.then(snapshot => ({
            playlistName: 'あとで聴く',
            playlistId: 'inbox',
            contents: snapshot.docs.map(d => ({...d.data(), id: d.id}))
        })));

        const allResults = await Promise.all(allContentsPromises);
        
        const flatResults = [];
        const lowerCaseQuery = searchQuery.toLowerCase();

        allResults.forEach(({ playlistName, playlistId, contents }) => {
            const matchingContents = contents.filter(c => 
                c.title.toLowerCase().includes(lowerCaseQuery) || 
                c.author.toLowerCase().includes(lowerCaseQuery)
            );
            if (matchingContents.length > 0) {
                flatResults.push(...matchingContents.map(c => ({...c, playlistName, playlistId})));
            }
        });

        setSearchResults(flatResults);
        setIsSearching(false);
    };


    // --- Sharing Logic ---
    const openShareModal = (playlist) => {
        setPlaylistToShare(playlist);
        setShareLink(`${window.location.origin}${window.location.pathname}?share_user=${user.uid}&share_playlist=${playlist.id}`);
        setIsShareModalOpen(true);
    };
    const closeShareModal = () => { setIsShareModalOpen(false); setPlaylistToShare(null); setShareLink(''); setIsCopied(false); };
    const togglePublicState = async (playlist) => {
        if (!db || !user) return;
        const newPublicState = !playlist.isPublic;
        await updateDoc(doc(db, `artifacts/${appId}/users/${user.uid}/playlists`, playlist.id), { isPublic: newPublicState });
        setPlaylistToShare({ ...playlist, isPublic: newPublicState });
    };
    const copyToClipboard = () => {
        const textField = document.createElement('textarea');
        textField.innerText = shareLink;
        document.body.appendChild(textField);
        textField.select();
        document.execCommand('copy');
        textField.remove();
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // --- Filtering Logic ---
    const toggleFilterTag = (tag) => {
        setActiveFilterTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredPlaylists = activeFilterTags.length > 0 
        ? playlists.filter(p => activeFilterTags.every(t => (p.tags || []).includes(t)))
        : playlists;
        
    // --- Render Logic ---
    const renderLoading = () => <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;

    if (shareMode) { /* Share mode UI */ return (
            <div className="bg-slate-50 text-slate-800 min-h-screen font-sans p-4 sm:p-6 lg:p-8 light-theme">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-6 bg-white/70 backdrop-blur-xl border border-white/80 p-4 rounded-xl shadow-sm">
                        <p className="font-semibold text-slate-700">共有されたプレイリストを閲覧中です</p>
                        <button onClick={() => window.location.href = window.location.pathname} className="mt-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors">自分のプレイリストに戻る</button>
                    </div>
                    {isLoadingPlaylists ? renderLoading() : sharedPlaylistData ? (
                        <main className="bg-white/70 backdrop-blur-xl border border-white/80 p-6 rounded-2xl shadow-lg">
                            <h2 className="text-3xl font-bold mb-6 text-indigo-600 truncate">{sharedPlaylistData.name}</h2>
                            {isLoadingContents ? renderLoading() : contents.length > 0 ? (
                                <ul className="space-y-4">{contents.map(c => (
                                    <li key={c.id} className="bg-white/80 border border-slate-200/80 p-4 rounded-lg"><div className="flex-grow"><p className="font-semibold text-slate-900">{c.title}</p><p className="text-sm text-indigo-600 mt-1">{c.author}</p><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 break-all text-sm flex items-center gap-1.5 mt-2 transition-colors"><LinkIcon size={14}/>{c.url}</a></div></li>
                                ))}</ul>
                            ) : <p className="text-slate-500 text-center py-16">このプレイリストにはコンテンツがありません。</p>}
                        </main>
                    ) : <p className="text-center text-red-500">このプレイリストを読み込めませんでした。</p>}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-slate-50 text-slate-800 min-h-screen font-sans p-4 sm:p-6 lg:p-8 light-theme flex flex-col">
            <div className="max-w-screen-xl mx-auto w-full flex-grow">
                <header className="my-12 sm:my-16 text-center">
                    <h1 className="text-3xl font-light text-slate-600 tracking-wider flex items-center justify-center gap-3">
                        <Waves size={28} className="text-slate-500"/>
                        <span>MyPlayLists</span>
                    </h1>
                    <p className="text-slate-500 mt-4 text-sm tracking-wide">
                        お気に入りのメディアを、もっと自由に。
                    </p>
                </header>
                {!isAuthReady ? renderLoading() : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Playlists Column */}
                        <aside className="lg:col-span-4 xl:col-span-3 bg-white/70 backdrop-blur-xl border border-white/80 p-6 rounded-2xl shadow-lg">
                            {user ? (
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                                        <span className="font-semibold text-slate-700">{user.displayName}</span>
                                    </div>
                                    <button onClick={handleLogout} className="text-slate-500 hover:text-rose-600 p-2 rounded-full transition-colors" title="ログアウト"><LogOut size={20}/></button>
                                </div>
                            ) : (
                                <div className="mb-6">
                                    <button 
                                        onClick={handleGoogleLogin} 
                                        disabled={!auth}
                                        className="w-full flex items-center justify-center gap-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                                    >
                                        {!auth ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                                        <span>{!auth ? '準備中...' : 'Googleでログイン'}</span>
                                    </button>
                                    {firebaseError && <p className="text-red-500 text-xs mt-2">{firebaseError}</p>}
                                </div>
                            )}
                            
                            {user && <>
                                <form onSubmit={handleSearch} className="relative mb-6">
                                    <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="全体検索..." className="w-full bg-white/50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                </form>
                                <h2 className="text-2xl font-semibold mb-5 text-slate-800">プレイリスト</h2>
                                <div className="space-y-2">
                                    <button onClick={() => { setSelectedPlaylist({id: 'inbox', name: 'あとで聴く'}); setActiveView('playlist'); }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${selectedPlaylist?.id === 'inbox' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-200/50'}`}>
                                        <Inbox size={18} /> <span className="font-medium">あとで聴く</span>
                                    </button>
                                    <hr className="my-2 border-slate-200"/>
                                </div>
                                {isLoadingPlaylists ? renderLoading() : (
                                    <ul className="space-y-2">{filteredPlaylists.map((playlist, index) => (
                                        <li key={playlist.id} draggable="true" onDragStart={(e) => draggedItem.current = index} onDrop={() => { const draggedIndex = draggedItem.current; if (draggedIndex === index) return; let newOrder = [...playlists]; const [item] = newOrder.splice(draggedIndex, 1); newOrder.splice(index, 0, item); setPlaylists(newOrder); handlePlaylistDragAndDrop(newOrder); }} onDragOver={(e) => e.preventDefault()} className="flex items-start gap-2 group cursor-grab active:cursor-grabbing rounded-lg transition-colors hover:bg-slate-200/50 p-2">
                                            <GripVertical className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0 ml-1 mt-3" size={18} />
                                            <div className="flex-grow">
                                                <button onClick={() => {setSelectedPlaylist(playlist); setActiveView('playlist');}} className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedPlaylist?.id === playlist.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`}><span className="font-medium">{playlist.name}</span></button>
                                                <div className="flex flex-wrap gap-1.5 mt-2 px-3">
                                                    {(playlist.tags || []).map(tag => <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600">{tag}</span>)}
                                                </div>
                                            </div>
                                        </li>
                                    ))}</ul>
                                )}
                                <div className="bg-white/50 border border-slate-200/80 p-4 rounded-xl my-6">
                                    <h3 className="text-lg font-semibold mb-3 text-indigo-600">新規作成</h3>
                                    <form onSubmit={handleCreatePlaylist} className="space-y-3">
                                        <input ref={newPlaylistInputRef} type="text" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="プレイリスト名" required className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" />
                                        <input type="text" list="tags-list" value={newPlaylistTags} onChange={(e) => setNewPlaylistTags(e.target.value)} placeholder="タグ (任意、なければ「タグ無し」)" className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" />
                                        <datalist id="tags-list">{allTags.map(tag => <option key={tag} value={tag} />)}</datalist>
                                        <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-lg flex-shrink-0 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2" title="プレイリストを追加"><Plus size={20} /><span>作成</span></button>
                                    </form>
                                </div>
                                
                                {allTags.length > 0 && (
                                    <div className={`p-4 rounded-xl mb-6 transition-colors ${isManagingTags ? 'bg-rose-50' : ''}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-lg font-semibold text-slate-700">{isManagingTags ? 'タグを管理' : 'タグで絞り込み'}</h3>
                                            <button onClick={() => setIsManagingTags(!isManagingTags)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">{isManagingTags ? '完了' : '管理'}</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {allTags.map(tag => (
                                                <div key={tag} className="flex items-center">
                                                    <button onClick={() => !isManagingTags && toggleFilterTag(tag)} className={`px-3 py-1 text-sm rounded-full transition-colors ${isManagingTags ? 'bg-slate-200 text-slate-600' : activeFilterTags.includes(tag) ? 'bg-indigo-500 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}>{tag}</button>
                                                    {isManagingTags && tag !== 'タグ無し' && (
                                                        <button onClick={() => requestDeleteTag(tag)} className="-ml-2 -mr-1 text-slate-400 hover:text-rose-600 bg-slate-200 hover:bg-rose-100 rounded-full p-0.5 transition-colors" title={`タグ「${tag}」を削除`}><X size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {activeFilterTags.length > 0 && !isManagingTags && <button onClick={() => setActiveFilterTags([])} className="text-xs text-slate-500 hover:text-indigo-600 mt-3">絞り込みをクリア</button>}
                                    </div>
                                )}
                            </>}
                        </aside>
                        {/* Contents Column */}
                        <main className="lg:col-span-8 xl:col-span-9 bg-white/70 backdrop-blur-xl border border-white/80 p-8 rounded-2xl shadow-lg min-h-[60vh]">
                           {!user ? (
                                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                                    <LogIn size={64} className="mb-4" />
                                    <h3 className="text-2xl font-semibold text-slate-600">ログインしてください</h3>
                                    <p className="mt-2">左側のボタンからGoogleアカウントでログインして、<br/>あなただけのプレイリスト管理を始めましょう。</p>
                                </div>
                           ) : activeView === 'search' ? (
                                <div>
                                    <h2 className="text-3xl font-semibold text-slate-800 mb-8">検索結果: "{searchQuery}"</h2>
                                    {isSearching ? renderLoading() : searchResults.length > 0 ? (
                                        <ul className="space-y-3">{searchResults.map(c => (
                                            <li key={c.id} className="bg-white/70 border border-slate-200/80 rounded-lg flex items-center gap-2 group animate-fade-in">
                                                <div className="flex-grow p-4">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-semibold text-slate-900 pr-4">{c.title}</p>
                                                        {c.platform && <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${getPlatformStyle(c.platform)}`}>{c.platform}</span>}
                                                    </div>
                                                    <p className="text-sm text-indigo-600 mt-1">{c.author}</p>
                                                    <p className="text-xs text-slate-400 mt-2">in: {c.playlistName}</p>
                                                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 break-all text-sm flex items-center gap-1.5 mt-2 transition-colors"><LinkIcon size={14}/>{c.url}</a>
                                                </div>
                                            </li>
                                        ))}</ul>
                                    ) : <p className="text-slate-500 text-center py-16">検索結果はありませんでした。</p>}
                                </div>
                           ) : selectedPlaylist ? (
                                <div>
                                    <div className="flex justify-between items-start mb-8 min-h-[48px]">
                                        {isEditingPlaylistName && selectedPlaylist.id !== 'inbox' ? (
                                            <div className="flex-grow flex flex-col gap-3 min-w-0">
                                                <input type="text" value={editingPlaylistData.name} onChange={(e) => setEditingPlaylistData({...editingPlaylistData, name: e.target.value})} className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2 text-3xl font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                                                <input type="text" list="tags-list" value={editingPlaylistData.tags} onChange={(e) => setEditingPlaylistData({...editingPlaylistData, tags: e.target.value})} placeholder="タグ (任意、なければ「タグ無し」)" className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" />
                                                <div className="flex-shrink-0 flex items-center gap-2">
                                                    <button onClick={handleSavePlaylistName} className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors" title="保存"><Check size={20} /></button>
                                                    <button onClick={handleCancelEditingPlaylist} className="p-3 bg-slate-400 hover:bg-slate-500 text-white rounded-lg transition-colors" title="キャンセル"><X size={20} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-4 flex-grow min-w-0">
                                                    <h2 className="text-3xl font-semibold text-slate-800 truncate">{selectedPlaylist.name}</h2>
                                                </div>
                                                {selectedPlaylist.id !== 'inbox' && (
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button onClick={handleStartEditingPlaylist} className="text-slate-500 hover:text-amber-500 p-2 rounded-full transition-colors" title="プレイリストを編集"><Edit size={18} /></button>
                                                        <button onClick={() => openShareModal(selectedPlaylist)} className="text-slate-500 hover:text-indigo-600 p-2 rounded-full transition-colors" title="共有"><Share2 size={18}/></button>
                                                        <button onClick={() => requestDeletePlaylist(selectedPlaylist)} className="text-slate-500 hover:text-rose-600 p-2 rounded-full transition-colors" title="プレイリストを削除"><Trash2 size={18}/></button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="bg-white/50 border border-slate-200/80 p-6 rounded-xl mb-8">
                                        <h3 className="text-xl font-semibold mb-4 text-indigo-600">コンテンツを追加</h3>
                                        <form onSubmit={handleAddContent} noValidate className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input ref={newContentUrlInputRef} type="url" value={newContentUrl} onChange={(e) => {setNewContentUrl(e.target.value); if (contentFormError) setContentFormError('');}} placeholder="* URL" required className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" /><input type="text" value={newContentTitle} onChange={(e) => setNewContentTitle(e.target.value)} placeholder="タイトル (任意)" className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" /></div>
                                            <div className="flex gap-4 items-end"><div className="flex-grow"><label htmlFor="author-input" className="text-sm text-slate-600 mb-1 block">作者 / チャンネル名</label><input id="author-input" list="authors-list" type="text" value={newContentAuthor} onChange={(e) => setNewContentAuthor(e.target.value)} placeholder="作者名" className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition placeholder:text-slate-400" /><datalist id="authors-list">{personalities.map(p => <option key={p} value={p} />)}</datalist></div><button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-3.5 py-3.5 rounded-lg flex-shrink-0 disabled:bg-slate-400 transition-colors h-[44px]" title="コンテンツを追加"><Plus size={20} /></button></div>
                                            {contentFormError && <p className="text-red-500 text-sm mt-2">{contentFormError}</p>}
                                        </form>
                                    </div>
                                    {isLoadingContents ? renderLoading() : (selectedPlaylist.id === 'inbox' ? inboxContents : contents).length > 0 ? (
                                        <ul className="space-y-3">{(selectedPlaylist.id === 'inbox' ? inboxContents : contents).map((c, index) => (
                                            <li key={c.id} draggable={selectedPlaylist.id !== 'inbox'} onDragStart={() => draggedItem.current = index} onDrop={() => { const draggedIndex = draggedItem.current; if (draggedIndex === index) return; let newOrder = [...contents]; const [item] = newOrder.splice(draggedIndex, 1); newOrder.splice(index, 0, item); setContents(newOrder); handleContentDragAndDrop(newOrder); }} onDragOver={(e) => e.preventDefault()} className="bg-white/70 border border-slate-200/80 rounded-lg flex items-center gap-2 group cursor-grab active:cursor-grabbing animate-fade-in">
                                                <GripVertical className="text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0 ml-3" size={20} />
                                                {editingContentId === c.id ? (
                                                    <div className="flex-grow p-4 space-y-3">
                                                        <input type="text" placeholder="タイトル" value={editingContentData.title} onChange={e => setEditingContentData({...editingContentData, title: e.target.value})} className="w-full bg-white/80 border border-slate-300 rounded-md px-3 py-1.5 text-base" />
                                                        <input type="text" placeholder="作者 / チャンネル名" value={editingContentData.author} onChange={e => setEditingContentData({...editingContentData, author: e.target.value})} className="w-full bg-white/80 border border-slate-300 rounded-md px-3 py-1.5 text-sm" />
                                                        <input type="url" placeholder="URL" value={editingContentData.url} onChange={e => setEditingContentData({...editingContentData, url: e.target.value})} className="w-full bg-white/80 border border-slate-300 rounded-md px-3 py-1.5 text-sm" />
                                                        <div className="flex gap-2 pt-2">
                                                            <button onClick={() => handleSaveContent(c.id)} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors" title="保存"><Check size={16} /></button>
                                                            <button onClick={handleCancelEditingContent} className="p-2 bg-slate-400 hover:bg-slate-500 text-white rounded-md transition-colors" title="キャンセル"><X size={16} /></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex-grow p-4">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-semibold text-slate-900 pr-4">{c.title}</p>
                                                            {c.platform && <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${getPlatformStyle(c.platform)}`}>{c.platform}</span>}
                                                        </div>
                                                        <p className="text-sm text-indigo-600 mt-1">{c.author}</p>
                                                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 break-all text-sm flex items-center gap-1.5 mt-2 transition-colors"><LinkIcon size={14}/>{c.url}</a>
                                                    </div>
                                                )}
                                                <div className="flex flex-col p-2 self-start">
                                                    <div className="relative">
                                                        <button onClick={() => setShowMoveMenu(showMoveMenu === c.id ? null : c.id)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-md" title="移動"><Move size={16} /></button>
                                                        {showMoveMenu === c.id && (
                                                            <div className="absolute right-full top-0 mr-2 w-48 bg-white rounded-lg shadow-xl border z-10">
                                                                <p className="text-xs text-slate-500 p-2 border-b">プレイリストに移動</p>
                                                                <ul className="max-h-48 overflow-y-auto">
                                                                    {selectedPlaylist.id !== 'inbox' && <li><button onClick={() => handleMoveContent(c, 'inbox')} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"><Inbox size={14} /> あとで聴く</button></li>}
                                                                    {playlists.filter(p => p.id !== selectedPlaylist.id).map(p => (<li key={p.id}><button onClick={() => handleMoveContent(c, p.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50">{p.name}</button></li>))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => handleStartEditingContent(c)} className="text-slate-400 hover:text-amber-500 p-2 rounded-md" title="編集"><Edit size={16} /></button>
                                                    <button onClick={() => requestDeleteContent(c)} className="text-slate-400 hover:text-rose-600 p-2 rounded-md" title="削除"><Trash2 size={16} /></button>
                                                </div>
                                            </li>
                                        ))}</ul>
                                    ) : <p className="text-slate-500 text-center py-16">このプレイリストにはまだコンテンツがありません。</p>}
                                </div>
                            ) : (<div className="flex flex-col items-center justify-center h-full text-center text-slate-500"><ListMusic size={64} className="mb-4" /><h3 className="text-2xl font-semibold text-slate-600">プレイリストを選択してください</h3><p className="mt-2">左側のリストからプレイリストを選ぶか、新しいプレイリストを作成してください。</p></div>)}
                        </main>
                    </div>
                )}
            </div>
            <footer className="text-center py-8 mt-12 border-t border-slate-200">
                <div className="flex justify-center items-center gap-6 text-sm text-slate-500">
                    <button onClick={() => setIsPrivacyModalOpen(true)} className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"><Shield size={14}/>プライバシーポリシー</button>
                    <button onClick={() => setIsContactModalOpen(true)} className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"><Mail size={14}/>お問い合わせ</button>
                </div>
                <p className="text-xs text-slate-400 mt-4">© 2024 ikmkbys. All Rights Reserved.</p>
            </footer>
            {/* Modals */}
            {isShareModalOpen && <ShareModal playlist={playlistToShare} shareLink={shareLink} isCopied={isCopied} copyToClipboard={copyToClipboard} togglePublicState={togglePublicState} closeModal={closeShareModal} />}
            {confirmDeleteInfo && <ConfirmDeleteModal info={confirmDeleteInfo} onConfirm={handleConfirmDelete} onCancel={() => setConfirmDeleteInfo(null)} />}
            {isPrivacyModalOpen && <PrivacyPolicyModal closeModal={() => setIsPrivacyModalOpen(false)} />}
            {isContactModalOpen && <ContactModal closeModal={() => setIsContactModalOpen(false)} />}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap');
                .light-theme { 
                    font-family: 'Inter', sans-serif; 
                    background-color: #f8fafc;
                    background-image: radial-gradient(#dbeafe 0.5px, transparent 0.5px), radial-gradient(#dbeafe 0.5px, #f8fafc 0.5px);
                    background-size: 20px 20px;
                    background-position: 0 0, 10px 10px;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
}

// --- Modal Components ---

const ModalWrapper = ({ children, closeModal }) => (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-fast" onClick={closeModal}>
        <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ShareModal = ({ playlist, shareLink, isCopied, copyToClipboard, togglePublicState, closeModal }) => (
    <ModalWrapper closeModal={closeModal}>
        <h3 className="text-2xl font-bold text-indigo-600 mb-2">プレイリストを共有</h3>
        <p className="text-slate-600 mb-6">「{playlist.name}」</p>
        <div className="flex items-center justify-between bg-slate-100/80 p-4 rounded-lg mb-6">
            <span className="font-medium text-slate-800">プレイリストを公開する</span>
            <button onClick={() => togglePublicState(playlist)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${playlist.isPublic ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${playlist.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
        {playlist.isPublic ? (
            <div className="animate-fade-in">
                <p className="text-sm text-slate-600 mb-2">下のリンクをコピーして共有できます:</p>
                <div className="flex gap-2">
                    <input type="text" readOnly value={shareLink} className="w-full bg-slate-200/80 border border-slate-300 rounded-lg px-3 py-2 text-slate-700" />
                    <button onClick={copyToClipboard} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors" title="コピー">
                        <Copy size={16} />
                        <span>{isCopied ? '完了' : ''}</span>
                    </button>
                </div>
            </div>
        ) : (
            <p className="text-sm text-amber-800 bg-amber-100 p-3 rounded-lg">このプレイリストは現在非公開です。公開すると共有リンクが表示されます。</p>
        )}
        <button onClick={closeModal} className="mt-8 w-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg transition-colors">閉じる</button>
    </ModalWrapper>
);

const ConfirmDeleteModal = ({ info, onConfirm, onCancel }) => (
    <ModalWrapper closeModal={onCancel}>
        <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
            <h3 className="mt-4 text-2xl font-bold text-slate-800">本当に削除しますか？</h3>
            <p className="mt-2 text-slate-600">「{info.name}」を削除します。この操作は元に戻せません。</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4">
            <button onClick={onConfirm} className="bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg transition-colors">削除する</button>
            <button onClick={onCancel} className="bg-slate-200/80 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg transition-colors">キャンセル</button>
        </div>
    </ModalWrapper>
);

const PrivacyPolicyModal = ({ closeModal }) => (
    <ModalWrapper closeModal={closeModal}>
        <h3 className="text-2xl font-bold text-indigo-600 mb-4">プライバシーポリシー</h3>
        <div className="space-y-4 text-slate-600 text-sm max-h-[60vh] overflow-y-auto pr-2">
            <p>本アプリケーション「MyPlayLists」（以下、本アプリ）は、開発者 ikmkbys（以下、当方）が提供するものです。ユーザーの皆様に安心してご利用いただくため、以下の通りプライバシーポリシーを定めます。</p>
            <div>
                <h4 className="font-semibold text-slate-800 mb-1">1. 収集する情報</h4>
                <p>本アプリでは、以下の情報を収集します。<br/>
                - Googleアカウント情報（表示名、メールアドレス、プロフィール写真）: ユーザー認証および識別のため。<br/>
                - ユーザーが作成したデータ（プレイリスト名、タグ、コンテンツのURL、タイトル、作者名など）: アプリの基本機能を提供するため。</p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-800 mb-1">2. 情報の利用目的</h4>
                <p>収集した情報は、以下の目的で利用します。<br/>
                - ログイン機能の提供<br/>
                - 複数端末間でのデータ同期<br/>
                - アプリの機能改善および不具合修正</p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-800 mb-1">3. 第三者への提供</h4>
                <p>法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。ただし、ユーザーが「共有」機能を利用した場合、発行されたURLを知る誰もが、そのプレイリストを閲覧できます。</p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-800 mb-1">4. データの保管</h4>
                <p>ユーザーデータは、Googleが提供するFirebaseのセキュアなデータベースに保管されます。</p>
            </div>
            <div>
                <h4 className="font-semibold text-slate-800 mb-1">5. データの削除</h4>
                <p>ユーザーは、アプリ内の機能を用いて、いつでも自身のプレイリストやコンテンツを削除することができます。</p>
            </div>
        </div>
        <button onClick={closeModal} className="mt-8 w-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg transition-colors">閉じる</button>
    </ModalWrapper>
);

const ContactModal = ({ closeModal }) => {
    const [sent, setSent] = useState(false);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        const myForm = e.target;
        const formData = new FormData(myForm);

        fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(formData).toString(),
        })
        .then(() => setSent(true))
        .catch((error) => alert(error));
    };

    return (
        <ModalWrapper closeModal={closeModal}>
            <h3 className="text-2xl font-bold text-indigo-600 mb-4">お問い合わせ</h3>
            {sent ? (
                <div className="text-center py-8">
                    <Check className="mx-auto h-12 w-12 text-green-500" />
                    <p className="mt-4 text-slate-700">メッセージが送信されました。ありがとうございました。</p>
                </div>
            ) : (
                <form 
                    name="contact" 
                    method="POST" 
                    data-netlify="true" 
                    data-netlify-honeypot="bot-field"
                    onSubmit={handleSubmit} 
                    className="space-y-4"
                >
                    <input type="hidden" name="form-name" value="contact" />
                    <p style={{ display: 'none' }}>
                        <label>
                            Don’t fill this out if you’re human: <input name="bot-field" />
                        </label>
                    </p>
                    <p className="text-sm text-slate-600">ご意見・ご感想・不具合のご報告など、お気軽にお寄せください。</p>
                    <div>
                        <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-700 mb-1">件名</label>
                        <input type="text" id="contact-subject" name="subject" required className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                    </div>
                    <div>
                        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1">内容</label>
                        <textarea id="contact-message" name="message" rows="4" required className="w-full bg-white/80 border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"></textarea>
                    </div>
                    <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-lg transition-colors">送信する</button>
                </form>
            )}
        </ModalWrapper>
    );
};
