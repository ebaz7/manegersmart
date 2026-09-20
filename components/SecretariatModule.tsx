import React, { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// Register custom fonts and sizes in Quill using style attributors for 100% universal compatibility
if (typeof window !== "undefined" && ReactQuill) {
  try {
    const Quill = (ReactQuill as any).Quill;
    if (Quill && typeof Quill.import === "function") {
      // 1. Register Font family style attributor (uses inline style instead of class)
      try {
        const Font = Quill.import("attributors/style/font") as any;
        if (Font) {
          Font.whitelist = [
            "Vazirmatn",
            "Shabnam",
            "Sahel",
            "Gandom",
            "Estedad",
            "Samim",
            "Tanha",
            "Tahoma",
            "Arial",
            "Times New Roman",
            "Courier New",
          ];
          Quill.register(Font, true);
        }
      } catch (e) {
        console.warn("Quill font attributor init skipped:", e);
      }

      // 2. Register Font size style attributor (uses inline style instead of class)
      try {
        const Size = Quill.import("attributors/style/size") as any;
        if (Size) {
          Size.whitelist = [
            "9px",
            "10px",
            "11px",
            "12px",
            "13px",
            "14px",
            "15px",
            "16px",
            "17px",
            "18px",
            "19px",
            "20px",
            "22px",
            "24px",
            "28px",
            "32px",
            "36px",
            "48px",
          ];
          Quill.register(Size, true);
        }
      } catch (e) {
        console.warn("Quill size attributor init skipped:", e);
      }

      // 3. Register align and direction style attributors
      try {
        const Align = Quill.import("attributors/style/align") as any;
        if (Align) {
          Quill.register(Align, true);
        }
      } catch (e) {}

      try {
        const Direction = Quill.import("attributors/style/direction") as any;
        if (Direction) {
          Quill.register(Direction, true);
        }
      } catch (e) {}

      // 4. Register Line Height if Parchment constructor is available
      try {
        const Parchment = Quill.import("parchment");
        const StyleAttributor =
          Parchment?.Attributor?.Style ||
          Parchment?.StyleAttributor ||
          (typeof Parchment?.Attributor === "function" ? Parchment.Attributor : null);
        if (typeof StyleAttributor === "function") {
          const LineHeightStyle = new StyleAttributor(
            "lineHeight",
            "line-height",
            {
              scope: Parchment.Scope?.BLOCK || 3,
              whitelist: ["1.0", "1.5", "2.0", "2.5", "3.0"],
            },
          );
          Quill.register(LineHeightStyle, true);
        }
      } catch (e) {
        console.warn("LineHeight attributor skipped:", e);
      }
    }
  } catch (err) {
    console.warn("ReactQuill configuration caught gracefully:", err);
  }
}

import { motion, AnimatePresence } from "motion/react";
import {
  Building,
  Building2,
  Lock,
  Unlock,
  FileText,
  Archive,
  Settings2,
  Plus,
  Search,
  FileDown,
  Upload,
  Check,
  UserPlus,
  MessageSquare,
  Trash2,
  Printer,
  UserCheck,
  X,
  Share2,
  Calendar,
  ArrowRight,
  CornerDownLeft,
  CheckCircle,
  Image as ImageIcon,
  ChevronLeft,
  Loader2,
  FileCheck,
  Save,
  Award,
  Edit,
  Eye,
  Volume2,
  Sliders,
  Shield,
  BookOpen,
  Stamp,
  Move,
  Ruler,
  RefreshCw,
  Hash,
  Copy,
  CheckSquare,
  Square,
  Users,
  Layers,
  LayoutTemplate,
  HelpCircle,
  Sparkles,
  Filter,
  CheckCheck,
  XSquare,
} from "lucide-react";

import {
  User,
  UserRole,
  SystemSettings,
  Company,
  SecretariatLetter,
  SecretariatLetterStatus,
  SecretariatLetterComment,
  SecretariatLetterAttachment,
  SecretariatCompanySettings,
  SecretariatTemplate,
} from "../types";

import {
  getSecretariatLetters,
  saveSecretariatLetter,
  updateSecretariatLetter,
  deleteSecretariatLetter,
  getSecretariatSettings,
  saveSecretariatSettings,
  getSettings,
  uploadFile,
  getSecretariatTemplates,
  saveSecretariatTemplate,
  deleteSecretariatTemplate,
  importDocx,
} from "../services/storageService";

import { getUsers } from "../services/authService";
import { generateUUID, getCurrentShamsiDate } from "../constants";
import { shareElementToChat, openSendToChat } from "../services/chatShareService";

const toPersianDigits = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null) return "";
  const englishDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(
      new RegExp(englishDigits[i], "g"),
      persianDigits[i],
    );
  }
  return result;
};

interface SecretariatModuleProps {
  currentUser: User;
}

const SecretariatModule: React.FC<SecretariatModuleProps> = ({
  currentUser,
}) => {
  // --- Data Loading & States ---
  const [letters, setLetters] = useState<SecretariatLetter[]>([]);
  const [secSettings, setSecSettings] = useState<SecretariatCompanySettings[]>(
    [],
  );
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(
    null,
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Nav / UI Control ---
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeSection, setActiveSection] = useState<
    "headquarters" | "factory" | null
  >(null);
  const [activeTab, setActiveTab] = useState<
    "cartable" | "archive" | "templates" | "settings"
  >("cartable");
  const [settingsSubTab, setSettingsSubTab] = useState<
    "permissions" | "numbering" | "letterhead" | "stamp" | "word"
  >("permissions");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("all");

  // --- Search & Filters ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "internal" | "incoming" | "outgoing"
  >("all");

  // --- Modals & Forms ---
  const [showNewLetterModal, setShowNewLetterModal] = useState(false);
  const [editingLetterId, setEditingLetterId] = useState<string | null>(null);
  const [selectedLetterForView, setSelectedLetterForView] =
    useState<SecretariatLetter | null>(null);
  const [isPrintMode, setIsPrintMode] = useState<SecretariatLetter | null>(
    null,
  );
  const [isSharingLetter, setIsSharingLetter] = useState(false);

  const handleShareSecretariatLetterToChat = async (targetLetter?: SecretariatLetter | null) => {
    const letterToShare = targetLetter || isPrintMode || selectedLetterForView;
    if (!letterToShare) return;
    setIsSharingLetter(true);
    try {
      let el = document.getElementById("print-content-section");
      if (!el) {
        setIsPrintMode(letterToShare);
        await new Promise((r) => setTimeout(r, 450));
        el = document.getElementById("print-content-section");
      }
      if (!el) throw new Error("المان بخش چاپ نامه یافت نشد");
      await shareElementToChat(
        el,
        `Letter_${letterToShare.letterNumber || letterToShare.id}.jpg`,
        {
          defaultMessage: `📄 نامه اداری شماره ${letterToShare.letterNumber || '-'}: ${letterToShare.subject || ''}`,
          title: "ارسال نامه اداری به گفتگو"
        }
      );
    } catch (e) {
      console.error(e);
      alert("خطا در آماده‌سازی نامه اداری جهت ارسال به گفتگو");
    } finally {
      setIsSharingLetter(false);
    }
  };

  // --- New Letter Form State ---
  const initialFormState = {
    date: "",
    subject: "",
    content: "",
    sender: "",
    receiver: "",
    type: "internal" as "internal" | "incoming" | "outgoing",
    attachments: [] as SecretariatLetterAttachment[],
    addCompanyStamp: false,
    isPrivate: false,
    signOffText: "با تشکر",
    signers: [] as { name: string; title: string; userId?: string }[],
    paperSize: "A4" as "A4" | "A5",
    orientation: "portrait" as "portrait" | "landscape",
    signaturePosition: "bottom_left" as
      "bottom_left" | "bottom_center" | "bottom_right",
    hideSubjectInLetter: true,
    hideSalutationInLetter: true,
  };
  const [newLetterForm, setNewLetterForm] = useState(initialFormState);

  const resetForm = () => {
    setNewLetterForm(initialFormState);
    setEditingLetterId(null);
  };
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editorZoom, setEditorZoom] = useState<number>(100);
  const [commentText, setCommentText] = useState("");
  const [selectedReferrals, setSelectedReferrals] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Templates & Import States ---
  const [templates, setTemplates] = useState<SecretariatTemplate[]>([]);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<Partial<SecretariatTemplate> | null>(null);
  const [uploadingWordLetterhead, setUploadingWordLetterhead] = useState(false);
  const wordLetterheadInputRef = useRef<HTMLInputElement>(null);
  const [importingDocxFile, setImportingDocxFile] = useState(false);
  const docxImportInputRef = useRef<HTMLInputElement>(null);

  // --- Google Docs Style States & Handlers ---
  const quillRef = useRef<any>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [activeMenu, setActiveMenu] = useState<
    | "file"
    | "edit"
    | "insert"
    | "format"
    | "tools"
    | "help"
    | "templates"
    | null
  >(null);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [showAdvancedOptionsModal, setShowAdvancedOptionsModal] = useState(false);

  const handleFindReplace = () => {
    if (!findText) return;
    const updated = newLetterForm.content.split(findText).join(replaceText);
    setNewLetterForm({ ...newLetterForm, content: updated });
  };

  const insertHTML = (html: string) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection();
      const index = range ? range.index : quill.getLength();
      quill.clipboard.dangerouslyPasteHTML(index, html);
    }
  };

  const handleTTS = () => {
    if (typeof window === "undefined") return;
    if (isReadingAloud) {
      window.speechSynthesis.cancel();
      setIsReadingAloud(false);
    } else {
      const cleanText = newLetterForm.content.replace(/<[^>]*>/g, "").trim();
      if (!cleanText) return;
      setIsReadingAloud(true);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "fa-IR";
      utterance.onend = () => {
        setIsReadingAloud(false);
      };
      utterance.onerror = () => {
        setIsReadingAloud(false);
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleUndo = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.history.undo();
    }
  };

  const handleRedo = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.history.redo();
    }
  };

  const handleSelectAll = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.setSelection(0, quill.getLength());
    }
  };

  const handleClearFormatting = () => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection();
      if (range) {
        quill.removeFormat(range.index, range.length);
      }
    }
  };

  // Close menus on click outside
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOutsideClick = () => {
      setActiveMenu(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // --- Settings Tab Form State ---
  const [companySettingsForm, setCompanySettingsForm] =
    useState<SecretariatCompanySettings>({
      companyId: "",
      headquartersAccessTokens: [],
      factoryAccessTokens: [],
      editAccessTokens: [],
      deleteAccessTokens: [],
      letterheadUrl: "",
      wordLetterheadUrl: "",
      letterheadFontFamily: "Vazirmatn",
      meetingMinutesTemplate: "",
      companyStampUrl: "",
      companyStampSize: 120,
      companyStampOpacity: 75,
      companyStampPosition: "bottom_left",
      marginTop: 40,
      marginBottom: 25,
      marginLeft: 20,
      marginRight: 20,
      metadataTop: 25,
      metadataLeft: 20,
      metadataFontSize: 11,
      metadataColor: "#0f172a",
      metadataFontWeight: "bold",
      metadataLineHeight: 1.8,
      autoNumberingEnabled: true,
      numberingPrefixHeadquarters: "HQ",
      numberingPrefixFactory: "FC",
      numberingFormat: "{PREFIX}-{YEAR}/{NUM}",
      numberingStartCounter: 1,
      numberingPadLength: 4,
      hideAutoFooter: false,
    });
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [lettersData, settingsData, sysSettings, usersData, templatesData] =
        await Promise.all([
          getSecretariatLetters(),
          getSecretariatSettings(),
          getSettings(),
          getUsers(),
          getSecretariatTemplates(),
        ]);
      setLetters(lettersData);
      setSecSettings(settingsData);
      setSystemSettings(sysSettings);
      setUsers(usersData);
      setTemplates(templatesData);

      // Auto-set shamsi date for form
      const d = getCurrentShamsiDate();
      const shamsiStr = `${d.year}/${String(d.month).padStart(2, "0")}/${String(d.day).padStart(2, "0")}`;
      setNewLetterForm((prev) => ({
        ...prev,
        date: shamsiStr,
      }));
    } catch (e) {
      console.error("Error loading Secretariat data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync settings form when active company changes
  useEffect(() => {
    if (selectedCompany) {
      const activeSettings = secSettings.find(
        (s) => s.companyId === selectedCompany.id,
      ) || {
        companyId: selectedCompany.id,
        headquartersAccessTokens: [],
        factoryAccessTokens: [],
        editAccessTokens: [],
        deleteAccessTokens: [],
        letterheadUrl: "",
        wordLetterheadUrl: "",
        letterheadFontFamily: "Vazirmatn",
        meetingMinutesTemplate: "",
        companyStampUrl: "",
        companyStampSize: 120,
        companyStampOpacity: 75,
        companyStampPosition: "bottom_left",
        marginTop: 40,
        marginBottom: 25,
        marginLeft: 20,
        marginRight: 20,
        metadataTop: 25,
        metadataLeft: 20,
        metadataFontSize: 11,
        metadataColor: "#0f172a",
        metadataFontWeight: "bold",
        metadataLineHeight: 1.8,
        autoNumberingEnabled: true,
        numberingPrefixHeadquarters: "HQ",
        numberingPrefixFactory: "FC",
        numberingFormat: "{PREFIX}-{YEAR}/{NUM}",
        numberingStartCounter: 1,
        numberingPadLength: 4,
        hideAutoFooter: false,
      };
      setCompanySettingsForm({
        ...activeSettings,
        headquartersAccessTokens: activeSettings.headquartersAccessTokens || [],
        factoryAccessTokens: activeSettings.factoryAccessTokens || [],
        editAccessTokens: activeSettings.editAccessTokens || [],
        deleteAccessTokens: activeSettings.deleteAccessTokens || [],
        autoNumberingEnabled: activeSettings.autoNumberingEnabled ?? true,
        numberingPrefixHeadquarters: activeSettings.numberingPrefixHeadquarters || "HQ",
        numberingPrefixFactory: activeSettings.numberingPrefixFactory || "FC",
        numberingFormat: activeSettings.numberingFormat || "{PREFIX}-{YEAR}/{NUM}",
        numberingStartCounter: activeSettings.numberingStartCounter ?? 1,
        numberingPadLength: activeSettings.numberingPadLength ?? 4,
        marginTop: activeSettings.marginTop ?? 40,
        marginBottom: activeSettings.marginBottom ?? 25,
        marginLeft: activeSettings.marginLeft ?? 20,
        marginRight: activeSettings.marginRight ?? 20,
        metadataTop: activeSettings.metadataTop ?? 25,
        metadataLeft: activeSettings.metadataLeft ?? 20,
        metadataFontSize: activeSettings.metadataFontSize ?? 11,
        metadataColor: activeSettings.metadataColor || "#0f172a",
        metadataFontWeight: activeSettings.metadataFontWeight || "bold",
        metadataLineHeight: activeSettings.metadataLineHeight ?? 1.8,
        companyStampSize: activeSettings.companyStampSize ?? 120,
        companyStampOpacity: activeSettings.companyStampOpacity ?? 75,
        companyStampPosition: activeSettings.companyStampPosition || "bottom_left",
        letterheadFontFamily: activeSettings.letterheadFontFamily || "Vazirmatn",
      });
    }
  }, [selectedCompany, secSettings]);

  // Auth/Permissions Check helpers
  const userRoles = currentUser.roles || [currentUser.role];
  const isSuperUser =
    userRoles.includes("admin") ||
    userRoles.includes("ceo") ||
    currentUser.canManageSecretariatSettings;

  const activeCompanySettings = secSettings.find(
    (s) => s.companyId === selectedCompany?.id,
  );
  const canEditLetters =
    isSuperUser ||
    activeCompanySettings?.editAccessTokens?.includes(currentUser.id);
  const canDeleteLetters =
    isSuperUser ||
    activeCompanySettings?.deleteAccessTokens?.includes(currentUser.id);

  const hasSectionAccess = (
    sec: "headquarters" | "factory",
    companyId: string,
  ) => {
    if (isSuperUser) return true;
    const companySet = secSettings.find((s) => s.companyId === companyId);
    if (!companySet) {
      // Default to true if not configured yet, so users are not blocked initially
      return currentUser.canAccessSecretariat;
    }
    const tokens =
      sec === "headquarters"
        ? companySet.headquartersAccessTokens || []
        : companySet.factoryAccessTokens || [];
    return tokens.includes(currentUser.id) || currentUser.canAccessSecretariat;
  };

  // Companies List derived from system settings
  const availableCompanies = (systemSettings?.companies || []).filter(
    (comp) => {
      if (isSuperUser) return true;

      // Check if user has access to this company's secretariat in secSettings
      const compSettings = secSettings.find((s) => s.companyId === comp.id);
      if (compSettings) {
        if (compSettings.headquartersAccessTokens?.includes(currentUser.id))
          return true;
        if (compSettings.factoryAccessTokens?.includes(currentUser.id))
          return true;
      }

      // Legacy check
      if (currentUser.secretariatAllowedCompanies?.includes(comp.id))
        return true;

      return false;
    },
  );

  // Filter letters based on current company, section, tab (cartable vs archive) and search parameters
  const filteredLetters = letters.filter((letter) => {
    if (!selectedCompany || !activeSection) return false;

    // Match Company and Section
    if (
      letter.companyId !== selectedCompany.id ||
      letter.section !== activeSection
    )
      return false;

    // Match tab (archive displays archived, cartable displays the rest)
    if (activeTab === "archive") {
      if (letter.status !== SecretariatLetterStatus.ARCHIVED) return false;
    } else {
      if (letter.status === SecretariatLetterStatus.ARCHIVED) return false;
    }

    // Privacy and Cartable Relevance filter
    const isCreator = letter.createdBy === currentUser.id;
    const isReferred = letter.referredTo?.includes(currentUser.id);
    const isSigner = letter.signers?.some((s) => s.userId === currentUser.id);
    const isRelevantToUser = isCreator || isReferred || isSigner;

    if (!isSuperUser) {
      if (letter.isPrivate && !isRelevantToUser) {
        return false; // Private letters only visible to relevant users and super users
      }

      // In cartable (non-archive), only show relevant letters to non-superusers so it doesn't clutter
      if (activeTab === "cartable" && !isRelevantToUser) {
        return false;
      }
    }

    // Match type filter
    if (filterType !== "all" && letter.type !== filterType) return false;

    // Match Search query (subject, content, letter number, sender, receiver)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchSubject = letter.subject?.toLowerCase().includes(query);
      const matchNum = letter.letterNumber?.toLowerCase().includes(query);
      const matchSender = letter.sender?.toLowerCase().includes(query);
      const matchReceiver = letter.receiver?.toLowerCase().includes(query);
      const matchContent = letter.content?.toLowerCase().includes(query);
      return (
        matchSubject || matchNum || matchSender || matchReceiver || matchContent
      );
    }

    return true;
  });

  // Calculate Sequential Auto-Letter Number based on Company Settings
  const getNextLetterNumber = (
    company: Company,
    section: "headquarters" | "factory",
    customSettings?: SecretariatCompanySettings,
  ) => {
    const settings = customSettings || companySettingsForm;
    const prefix =
      section === "headquarters"
        ? settings.numberingPrefixHeadquarters || "HQ"
        : settings.numberingPrefixFactory || "FC";

    const matchedLetters = letters.filter(
      (l) => l.companyId === company.id && l.section === section,
    );
    const startCounter = settings.numberingStartCounter ?? 1;
    const count = matchedLetters.length + startCounter;
    const padLen = settings.numberingPadLength ?? 4;
    const seq = String(count).padStart(padLen, "0");
    const year = String(getCurrentShamsiDate().year);

    const format = settings.numberingFormat || "{PREFIX}-{YEAR}/{NUM}";
    return format
      .replace(/{PREFIX}/g, prefix)
      .replace(/{YEAR}/g, year)
      .replace(/{NUM}/g, seq)
      .replace(/{SECTION}/g, section === "headquarters" ? "HQ" : "FC")
      .replace(/{COMPANY_CODE}/g, company.nationalId ? company.nationalId.slice(-3) : "01");
  };

  const handleOpenNewLetterModal = () => {
    resetForm();
    const currentDate = getCurrentShamsiDate();
    setNewLetterForm((p) => ({
      ...p,
      date: `${currentDate.year}/${String(currentDate.month).padStart(2, "0")}/${String(currentDate.day).padStart(2, "0")}`,
      content: companySettingsForm.meetingMinutesTemplate || "",
    }));
    setShowNewLetterModal(true);
  };

  const handleEditLetterClick = (letter: SecretariatLetter) => {
    setNewLetterForm({
      date: letter.date || "",
      subject: letter.subject || "",
      content: letter.content || "",
      sender: letter.sender || "",
      receiver: letter.receiver || "",
      type: letter.type || "internal",
      attachments: letter.attachments || [],
      addCompanyStamp: letter.addCompanyStamp || false,
      isPrivate: letter.isPrivate || false,
      signOffText: letter.signOffText || "با تشکر",
      signers: letter.signers || [],
      paperSize: letter.paperSize || "A4",
      orientation: letter.orientation || "portrait",
      signaturePosition: letter.signaturePosition || "bottom_left",
      hideSubjectInLetter: letter.hideSubjectInLetter || false,
      hideSalutationInLetter: letter.hideSalutationInLetter || false,
    });
    setEditingLetterId(letter.id);
    setSelectedLetterForView(null);
    setShowNewLetterModal(true);
  };

  // Handlers for Letter Submissions
  const handleSaveLetter = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedCompany || !activeSection) return;

    if (editingLetterId) {
      const existingLetter = letters.find((l) => l.id === editingLetterId);
      if (!existingLetter) return;

      const updatedLetter: SecretariatLetter = {
        ...existingLetter,
        date: newLetterForm.date,
        subject: newLetterForm.subject,
        content: newLetterForm.content,
        sender: newLetterForm.sender,
        receiver: newLetterForm.receiver,
        type: newLetterForm.type,
        attachments: newLetterForm.attachments,
        addCompanyStamp: newLetterForm.addCompanyStamp,
        isPrivate: newLetterForm.isPrivate,
        signOffText: newLetterForm.signOffText,
        signers: newLetterForm.signers,
        paperSize: newLetterForm.paperSize,
        orientation: newLetterForm.orientation,
        signaturePosition: newLetterForm.signaturePosition,
        hideSubjectInLetter: newLetterForm.hideSubjectInLetter,
        hideSalutationInLetter: newLetterForm.hideSalutationInLetter,
        updatedAt: Date.now(),
      };

      try {
        const updatedList = await updateSecretariatLetter(updatedLetter);
        setLetters(updatedList);
        setShowNewLetterModal(false);
        resetForm();
      } catch (err) {
        alert("خطا در بروزرسانی نامه");
      }
    } else {
      const autoNum = getNextLetterNumber(selectedCompany, activeSection);
      const newLetter: SecretariatLetter = {
        id: generateUUID(),
        companyId: selectedCompany.id,
        section: activeSection,
        letterNumber: autoNum,
        date: newLetterForm.date,
        subject: newLetterForm.subject,
        content: newLetterForm.content,
        sender: newLetterForm.sender,
        receiver: newLetterForm.receiver,
        type: newLetterForm.type,
        status: SecretariatLetterStatus.PENDING,
        comments: [],
        attachments: newLetterForm.attachments,
        addCompanyStamp: newLetterForm.addCompanyStamp,
        isPrivate: newLetterForm.isPrivate,
        signOffText: newLetterForm.signOffText,
        signers: newLetterForm.signers,
        paperSize: newLetterForm.paperSize,
        orientation: newLetterForm.orientation,
        signaturePosition: newLetterForm.signaturePosition,
        hideSubjectInLetter: newLetterForm.hideSubjectInLetter,
        hideSalutationInLetter: newLetterForm.hideSalutationInLetter,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: currentUser.fullName,
      };

      try {
        const updatedList = await saveSecretariatLetter(newLetter);
        setLetters(updatedList);
        setShowNewLetterModal(false);
        resetForm();
      } catch (err) {
        alert("خطا در ذخیره‌سازی نامه");
      }
    }
  };

  // Save Current Form as Template
  const handleSaveAsTemplate = async () => {
    if (!newLetterForm.subject) {
      alert("لطفا ابتدا موضوع نامه را وارد کنید.");
      return;
    }
    const templateTitle = prompt(
      "نام قالب جدید را وارد کنید:",
      newLetterForm.subject,
    );
    if (!templateTitle) return;

    const newTemplate = {
      id: generateUUID(),
      title: templateTitle,
      subject: newLetterForm.subject,
      content: newLetterForm.content,
      createdAt: Date.now(),
    };

    try {
      await saveSecretariatTemplate(newTemplate);
      const updatedTemplates = await getSecretariatTemplates();
      setTemplates(updatedTemplates);
      alert("قالب با موفقیت ذخیره شد.");
    } catch (err) {
      alert("خطا در ذخیره قالب");
    }
  };

  // Upload Attachment Handler
  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setNewLetterForm((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            { fileName: file.name, url: res.url },
          ],
        }));
      } catch (err) {
        alert("خطا در آپلود فایل");
      } finally {
        setUploadingAttachment(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Remove Attachment
  const handleRemoveAttachment = (idx: number) => {
    setNewLetterForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx),
    }));
  };

  // Add Comment to Letter
  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedLetterForView) return;

    const newComment: SecretariatLetterComment = {
      id: generateUUID(),
      userId: currentUser.id,
      username: currentUser.fullName,
      comment: commentText,
      createdAt: Date.now(),
    };

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      comments: [...(selectedLetterForView.comments || []), newComment],
      updatedAt: Date.now(),
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      setCommentText("");
    } catch (err) {
      alert("خطا در ثبت نظر");
    }
  };

  // Refer Letter
  const handleReferLetter = async () => {
    if (selectedReferrals.length === 0 || !selectedLetterForView) return;

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      referredTo: Array.from(
        new Set([
          ...(selectedLetterForView.referredTo || []),
          ...selectedReferrals,
        ]),
      ),
      referredBy: currentUser.fullName,
      updatedAt: Date.now(),
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      setSelectedReferrals([]);
      alert("نامه با موفقیت ارجاع داده شد");
    } catch (err) {
      alert("خطا در ارجاع نامه");
    }
  };

  // Approve and Sign Letter
  const handleApproveSign = async () => {
    if (!selectedLetterForView) return;

    if (!currentUser.signatureUrl) {
      alert(
        'کاربر گرامی، امضای واقعی شما در پروفایل آپلود نشده است. لطفا ابتدا از منوی "کاربران" نسبت به آپلود تصویر امضای خود اقدام نمایید.',
      );
      return;
    }

    const currentApprovers = selectedLetterForView.approvedBy || [];
    if (currentApprovers.includes(currentUser.id)) {
      alert("شما قبلا این نامه را تایید و امضا کرده‌اید.");
      return;
    }

    const currentSignatures = selectedLetterForView.signatureImageUrls || [];

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      status: SecretariatLetterStatus.APPROVED,
      approvedBy: [...currentApprovers, currentUser.id],
      signatureImageUrls: [...currentSignatures, currentUser.signatureUrl],
      updatedAt: Date.now(),
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      alert("نامه با موفقیت تایید و امضای واقعی شما درج گردید.");
    } catch (err) {
      alert("خطا در تایید و امضای نامه");
    }
  };

  // Reject Letter
  const handleRejectLetter = async () => {
    if (!selectedLetterForView) return;

    const updatedLetter: SecretariatLetter = {
      ...selectedLetterForView,
      status: SecretariatLetterStatus.REJECTED,
      updatedAt: Date.now(),
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      setSelectedLetterForView(updatedLetter);
      alert("نامه رد شد");
    } catch (err) {
      alert("خطا در تغییر وضعیت نامه");
    }
  };

  // Archive / Unarchive Letter
  const handleToggleArchive = async (letter: SecretariatLetter) => {
    const isArchived = letter.status === SecretariatLetterStatus.ARCHIVED;
    const updatedLetter: SecretariatLetter = {
      ...letter,
      status: isArchived
        ? SecretariatLetterStatus.PENDING
        : SecretariatLetterStatus.ARCHIVED,
      updatedAt: Date.now(),
    };

    try {
      const updatedList = await updateSecretariatLetter(updatedLetter);
      setLetters(updatedList);
      if (selectedLetterForView?.id === letter.id) {
        setSelectedLetterForView(updatedLetter);
      }
      alert(
        isArchived
          ? "نامه از بایگانی خارج شد."
          : "نامه با موفقیت بایگانی گردید.",
      );
    } catch (err) {
      alert("خطا در تغییر وضعیت بایگانی");
    }
  };

  // Delete Letter
  const handleDeleteLetter = async (id: string) => {
    if (!window.confirm("آیا از حذف این نامه اداری اطمینان دارید؟")) return;

    try {
      const updatedList = await deleteSecretariatLetter(id);
      setLetters(updatedList);
      setSelectedLetterForView(null);
      alert("نامه با موفقیت حذف شد.");
    } catch (err) {
      alert("خطا در حذف نامه");
    }
  };

  // Save Secretariat Settings (Access control lists + templates)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const updatedSettings =
        await saveSecretariatSettings(companySettingsForm);
      setSecSettings(updatedSettings);
      alert("تنظیمات دبیرخانه این شرکت با موفقیت بروزرسانی شد.");
    } catch (err) {
      alert("خطا در ذخیره‌سازی تنظیمات");
    }
  };

  // Upload Letterhead image
  const handleLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setCompanySettingsForm((prev) => ({
          ...prev,
          letterheadUrl: res.url,
        }));
        alert("تصویر سربرگ با موفقیت بارگذاری شد.");
      } catch (err) {
        alert("خطا در آپلود سربرگ");
      } finally {
        setUploadingLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload Company Stamp image
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStamp(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setCompanySettingsForm((prev) => ({
          ...prev,
          companyStampUrl: res.url,
        }));
        alert("تصویر مهر رسمی شرکت با موفقیت بارگذاری شد.");
      } catch (err) {
        alert("خطا در آپلود مهر شرکت");
      } finally {
        setUploadingStamp(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save template
  const handleSaveTemplate = async (templateData: any) => {
    try {
      const updatedTemplates = await saveSecretariatTemplate(templateData);
      setTemplates(updatedTemplates);
      alert("قالب نمونه نامه با موفقیت ذخیره شد.");
      setEditingTemplate(null);
    } catch (err) {
      console.error(err);
      alert("خطا در ذخیره قالب نمونه نامه");
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("آیا از حذف این قالب نمونه نامه مطمئن هستید؟")) return;
    try {
      const updatedTemplates = await deleteSecretariatTemplate(id);
      setTemplates(updatedTemplates);
      alert("قالب نمونه نامه با موفقیت حذف شد.");
    } catch (err) {
      console.error(err);
      alert("خطا در حذف قالب نمونه نامه");
    }
  };

  // Upload Word (.docx) Letterhead File
  const handleWordLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingWordLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setCompanySettingsForm((prev) => ({
          ...prev,
          wordLetterheadUrl: res.url,
        }));
        alert("فایل سربرگ ورد (.docx) با موفقیت بارگذاری شد.");
      } catch (err) {
        console.error(err);
        alert("خطا در آپلود فایل سربرگ ورد");
      } finally {
        setUploadingWordLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Import text from Word (.docx) File
  const handleDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingDocxFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await importDocx(base64);
        if (res.success) {
          if (editingTemplate) {
            setEditingTemplate((prev) =>
              prev
                ? {
                    ...prev,
                    content: res.html,
                    title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
                  }
                : null,
            );
          } else {
            setNewLetterForm((prev) => ({
              ...prev,
              content: res.html,
              subject: prev.subject || file.name.replace(/\.[^/.]+$/, ""),
            }));
          }
          alert("متن سند ورد با موفقیت استخراج و به ویرایشگر اضافه شد.");
        } else {
          alert(
            "خطا در تبدیل سند ورد: " +
              (res.success === false ? "قالب ناسازگار" : "خطای سیستم"),
          );
        }
      } catch (err: any) {
        console.error(err);
        alert("خطا در استخراج محتوای فایل ورد: " + err.message);
      } finally {
        setImportingDocxFile(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  // Insert meeting minutes template into new letter content
  const handleInsertMinutesTemplate = () => {
    const activeSettings = secSettings.find(
      (s) => s.companyId === selectedCompany?.id,
    );
    if (activeSettings?.meetingMinutesTemplate) {
      setNewLetterForm((prev) => ({
        ...prev,
        content: activeSettings.meetingMinutesTemplate || "",
      }));
    } else {
      alert(
        'قالبی برای صورتجلسه این شرکت تنظیم نشده است. ابتدا از تب "تنظیمات دبیرخانه" قالب را ذخیره کنید.',
      );
    }
  };

  // --- RENDERS ---

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
        <span className="text-sm text-gray-500 font-medium">
          درحال بارگذاری محیط دبیرخانه...
        </span>
      </div>
    );
  }

  // 1.5 High level access guard
  const userHasAnyCompanyAccess = secSettings.some(
    (s) =>
      s.headquartersAccessTokens?.includes(currentUser.id) ||
      s.factoryAccessTokens?.includes(currentUser.id),
  );
  const isAuthorized =
    isSuperUser || currentUser.canAccessSecretariat || userHasAnyCompanyAccess;
  if (!isAuthorized) {
    return (
      <div
        className="glass-panel text-center p-12 max-w-lg mx-auto mt-12 rounded-2xl border space-y-3 bg-red-50/20 border-red-100"
        dir="rtl"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <Lock size={24} />
        </div>
        <h3 className="font-bold text-red-800 text-base">دسترسی غیرمجاز</h3>
        <p className="text-xs text-red-600 leading-relaxed font-medium">
          شما دسترسی لازم برای ورود به سیستم دبیرخانه اداری را ندارید. لطفا با
          مدیر سیستم تماس بگیرید تا دسترسی "دبیرخانه" را برای حساب کاربری شما
          فعال نماید.
        </p>
      </div>
    );
  }

  // 2. Company Initial Selector screen
  if (!selectedCompany) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
            <Building2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            سامانه دبیرخانه مرکزی
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            لطفا شرکت مورد نظر خود را جهت ورود به میزکار دبیرخانه انتخاب نمایید.
          </p>
        </div>

        {availableCompanies.length === 0 ? (
          <div className="glass-panel text-center p-8 rounded-2xl border border-dashed text-gray-500">
            هیچ شرکتی در تنظیمات سیستم تعریف نشده است. لطفا ابتدا شرکت‌ها را در
            تنظیمات عمومی سیستم مدیریت کنید.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCompanies.map((company) => (
              <motion.div
                key={company.id}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => setSelectedCompany(company)}
                className="glass-panel rounded-2xl border border-gray-150 p-6 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden bg-white/50"
              >
                <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-l from-purple-500 to-indigo-500 transform origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-black border">
                      {company.logo ? (
                        <img
                          src={company.logo}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        company.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">
                        {company.name}
                      </h3>
                      <span className="text-[10px] text-gray-400 font-mono">
                        شناسه ملی: {company.nationalId || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 leading-relaxed border-t pt-3 flex flex-col gap-1">
                    <span>شماره ثبت: {company.registrationNumber || "-"}</span>
                    <span>آدرس: {company.address || "-"}</span>
                  </div>
                </div>

                <div className="flex justify-end mt-4 items-center text-purple-600 gap-1 text-xs font-bold">
                  <span>انتخاب شرکت و ورود</span>
                  <ChevronLeft size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 3. Section Selector screen (HQ vs Factory)
  if (selectedCompany && !activeSection) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3 justify-between">
          <button
            onClick={() => setSelectedCompany(null)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight size={14} /> بازگشت به لیست شرکت‌ها
          </button>
          <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-bold">
            {selectedCompany.name}
          </span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900">
            انتخاب بخش دبیرخانه
          </h2>
          <p className="text-xs text-gray-500">
            برای کار با دبیرخانه این شرکت، یکی از بخش‌های مستقل زیر را انتخاب
            کنید.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Headquarters card */}
          <div
            onClick={() => {
              if (hasSectionAccess("headquarters", selectedCompany.id)) {
                setActiveSection("headquarters");
              } else {
                alert("شما به بخش دفتر مرکزی دبیرخانه این شرکت دسترسی ندارید.");
              }
            }}
            className={`glass-panel border rounded-2xl p-6 text-center cursor-pointer transition-all ${
              hasSectionAccess("headquarters", selectedCompany.id)
                ? "hover:shadow-lg border-purple-200 bg-purple-50/10"
                : "opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed"
            }`}
          >
            <div className="mx-auto w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Building className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">
              دبیرخانه دفتر مرکزی
            </h3>
            <p className="text-[11px] text-gray-500 mb-4">
              کارتابل و بایگانی مدارک و نامه‌های دفتر مرکزی
            </p>

            <div className="flex justify-center items-center gap-1 text-xs font-bold">
              {hasSectionAccess("headquarters", selectedCompany.id) ? (
                <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Unlock size={12} /> دسترسی مجاز
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Lock size={12} /> دسترسی محدود شده
                </span>
              )}
            </div>
          </div>

          {/* Factory card */}
          <div
            onClick={() => {
              if (hasSectionAccess("factory", selectedCompany.id)) {
                setActiveSection("factory");
              } else {
                alert("شما به بخش کارخانه دبیرخانه این شرکت دسترسی ندارید.");
              }
            }}
            className={`glass-panel border rounded-2xl p-6 text-center cursor-pointer transition-all ${
              hasSectionAccess("factory", selectedCompany.id)
                ? "hover:shadow-lg border-indigo-200 bg-indigo-50/10"
                : "opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed"
            }`}
          >
            <div className="mx-auto w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1">
              دبیرخانه کارخانه
            </h3>
            <p className="text-[11px] text-gray-500 mb-4">
              کارتابل و بایگانی مدارک و نامه‌های بخش کارخانه تولیدی
            </p>

            <div className="flex justify-center items-center gap-1 text-xs font-bold">
              {hasSectionAccess("factory", selectedCompany.id) ? (
                <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Unlock size={12} /> دسترسی مجاز
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full text-[10px]">
                  <Lock size={12} /> دسترسی محدود شده
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Main Secretariat Dashboard (when company and section are selected)
  return (
    <div className="space-y-6 animate-fade-in relative min-h-screen">
      <style>{`
        /* Load additional Persian fonts from CDN */
        @import url('https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css');
        @import url('https://cdn.jsdelivr.net/gh/rastikerdar/tanha-font@v0.9.0/dist/font-face.css');

        /* Clear any overlaps and make pickers spacious */
        .ql-snow .ql-picker.ql-font {
          width: 170px !important;
        }
        .ql-snow .ql-picker.ql-size {
          width: 140px !important;
        }
        .ql-snow .ql-picker.ql-header {
          width: 130px !important;
        }
        .ql-snow .ql-picker-label {
          padding-left: 8px !important;
          padding-right: 24px !important;
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-weight: 500 !important;
          color: #1e293b !important;
          font-size: 11px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          height: 28px !important;
        }
        .ql-snow .ql-picker-label::before {
          line-height: 28px !important;
        }
        .ql-snow .ql-picker-options {
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05) !important;
          border: 1px solid #cbd5e1 !important;
          padding: 6px !important;
          background: white !important;
        }
        .ql-snow .ql-picker-item {
          padding: 4px 8px !important;
          border-radius: 4px !important;
        }
        .ql-snow .ql-picker-item:hover {
          background-color: #f1f5f9 !important;
        }
        /* Style Quill toolbar */
        .ql-toolbar.ql-snow {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          border-top-left-radius: 12px !important;
          border-top-right-radius: 12px !important;
          padding: 8px 12px !important;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 4px !important;
        }
        /* Editor panel */
        .ql-container.ql-snow {
          border: 1px solid #cbd5e1 !important;
          border-top: none !important;
          border-bottom-left-radius: 12px !important;
          border-bottom-right-radius: 12px !important;
          background: white !important;
        }
        /* Custom toolbar icon sizes */
        .ql-snow .ql-toolbar button {
          width: 30px !important;
          height: 30px !important;
          padding: 4px !important;
          border-radius: 6px !important;
          transition: all 0.2s;
        }
        .ql-snow .ql-toolbar button:hover {
          background-color: rgba(0,0,0,0.05) !important;
          color: #6366f1 !important;
        }
        .ql-snow .ql-toolbar button.ql-active {
          background-color: #e0e7ff !important;
          color: #4f46e5 !important;
        }
        /* Separation in toolbar */
        .ql-snow .ql-toolbar .ql-formats {
          margin-right: 0px !important;
          margin-left: 8px !important;
          border-left: 1px solid #e2e8f0;
          padding-left: 8px;
          display: inline-flex !important;
          align-items: center;
          gap: 2px;
        }
        .ql-snow .ql-toolbar .ql-formats:first-child {
          border-left: none;
          padding-left: 0;
          margin-left: 0;
        }

        /* Custom Quill Toolbar Fonts Dropdown labels & typography rendering in Persian */
        .ql-snow .ql-picker.ql-font .ql-picker-label::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item::before {
          content: 'وزیر متن (پیش‌فرض)' !important;
          font-family: 'Vazirmatn', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Vazirmatn"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Vazirmatn"]::before {
          content: 'وزیر متن' !important;
          font-family: 'Vazirmatn', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Shabnam"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Shabnam"]::before {
          content: 'شبنم' !important;
          font-family: 'Shabnam', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Sahel"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Sahel"]::before {
          content: 'ساحل' !important;
          font-family: 'Sahel', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Gandom"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Gandom"]::before {
          content: 'گندم' !important;
          font-family: 'Gandom', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Estedad"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Estedad"]::before {
          content: 'استعداد' !important;
          font-family: 'Estedad', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Samim"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Samim"]::before {
          content: 'صمیم' !important;
          font-family: 'Samim', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Tanha"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Tanha"]::before {
          content: 'تنها' !important;
          font-family: 'Tanha', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Tahoma"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Tahoma"]::before {
          content: 'تاهوما' !important;
          font-family: 'Tahoma', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Arial"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Arial"]::before {
          content: 'Arial' !important;
          font-family: 'Arial', sans-serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Times New Roman"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Times New Roman"]::before {
          content: 'Times' !important;
          font-family: 'Times New Roman', serif !important;
        }
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Courier New"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Courier New"]::before {
          content: 'Courier' !important;
          font-family: 'Courier New', monospace !important;
        }

        /* Custom Font Sizes Dropdown labels in Quill Snow theme */
        .ql-snow .ql-picker.ql-size .ql-picker-label::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item::before {
          content: '۱۴ پیکسل (پیش‌فرض)' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="9px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="9px"]::before {
          content: '۹ ریز' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before {
          content: '۱۰ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="11px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="11px"]::before {
          content: '۱۱ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12px"]::before {
          content: '۱۲ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="13px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="13px"]::before {
          content: '۱۳ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14px"]::before {
          content: '۱۴ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="15px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="15px"]::before {
          content: '۱۵ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="16px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="16px"]::before {
          content: '۱۶ بزرگ' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="17px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="17px"]::before {
          content: '۱۷ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="18px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="18px"]::before {
          content: '۱۸ تیتر ریز' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="20px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="20px"]::before {
          content: '۲۰ متوسط' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="22px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="22px"]::before {
          content: '۲۲ سربرگ' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="24px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="24px"]::before {
          content: '۲۴ بزرگ' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="28px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="28px"]::before {
          content: '۲۸ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="32px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="32px"]::before {
          content: '۳۲ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="36px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="36px"]::before {
          content: '۳۶ پیکسل' !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="48px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="48px"]::before {
          content: '۴۸ عظیم' !important;
        }

        /* Force editor content alignment and typography defaults */
        .ql-editor {
          font-family: 'Vazirmatn', sans-serif !important;
          text-align: right !important;
          direction: rtl !important;
          line-height: 1.8 !important;
        }

        /* Robust printing fix */
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          /* Hide absolute top metadata blocks or modals overlay */
          .fixed.inset-0.z-50 {
            background: transparent !important;
            backdrop-filter: none !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .fixed.inset-0.z-50 > div {
            border: none !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Ensure the print content section occupies exactly the whole printable page */
          #print-content-section {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 9999999 !important;
            overflow: visible !important;
          }
          /* Hide buttons and other non-print elements */
          .print\\:hidden, button, .border-b.pb-3.print\\:hidden, .flex.items-center.justify-between.border-b.pb-3.print\\:hidden {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-900 border border-slate-200/60 p-4 rounded-2xl gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 hidden sm:block">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-gray-800 dark:text-white">
                {selectedCompany.name}
              </h1>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-black">
                دبیرخانه
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeSection === "headquarters" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"}`}
              >
                {activeSection === "headquarters" ? "دفتر مرکزی" : "کارخانه"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              مدیریت نامه‌ها، کارتابل جاری و آرشیو بایگانی اسناد اداری
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <button
            onClick={() => {
              setActiveSection(null);
              setActiveTab("cartable");
            }}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-all"
          >
            <ArrowRight size={14} /> تغییر بخش دبیرخانه
          </button>

          <button
            onClick={() => {
              setSelectedCompany(null);
              setActiveSection(null);
              setActiveTab("cartable");
            }}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-all"
          >
            تغییر شرکت
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl self-start flex-wrap">
          <button
            onClick={() => setActiveTab("cartable")}
            className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "cartable"
                ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText size={15} /> کارتابل اداری
          </button>

          <button
            onClick={() => setActiveTab("archive")}
            className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "archive"
                ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Archive size={15} /> آرشیو و بایگانی
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "templates"
                ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen size={15} /> قالب‌ها و نمونه‌نامه‌ها
          </button>

          {isSuperUser && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-lg transition-all ${
                activeTab === "settings"
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Settings2 size={15} /> تنظیمات، دسترسی‌ها و سربرگ
            </button>
          )}
        </div>

        <button
          onClick={handleOpenNewLetterModal}
          className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus size={16} /> ثبت نامه اداری جدید
        </button>
      </div>

      {/* TABS CONTENT */}

      {/* A. CARTABLE AND ARCHIVE VIEWS */}
      {(activeTab === "cartable" || activeTab === "archive") && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در موضوع، شماره نامه، فرستنده و گیرنده..."
                className="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Letter Type Filters */}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-1 bg-slate-50 border p-1 rounded-xl self-start w-full md:w-auto">
              {[
                { id: "all", label: "همه نامه‌ها" },
                { id: "internal", label: "داخلی" },
                { id: "incoming", label: "وارده" },
                { id: "outgoing", label: "صادره" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFilterType(opt.id as any)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${filterType === opt.id ? "bg-white text-slate-800 shadow-sm border border-slate-100" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Letter List Grid */}
          {filteredLetters.length === 0 ? (
            <div className="glass-panel text-center py-16 px-4 rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm mb-1">
                نامه‌ای یافت نشد
              </h3>
              <p className="text-xs text-slate-400">
                هیچ نامه‌ای با فیلترها و معیارهای مورد نظر شما یافت نشد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLetters.map((letter) => {
                const isReferredToMe = letter.referredTo?.includes(
                  currentUser.id,
                );
                return (
                  <motion.div
                    key={letter.id}
                    layoutId={`letter-card-${letter.id}`}
                    whileHover={{ y: -2 }}
                    className={`glass-panel border rounded-2xl p-4 flex flex-col justify-between transition-all bg-white relative ${
                      isReferredToMe
                        ? "border-amber-200 shadow-sm ring-1 ring-amber-100"
                        : "border-slate-150 shadow-xs"
                    }`}
                  >
                    {isReferredToMe && (
                      <span className="absolute -top-2.5 -left-2.5 bg-amber-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <CornerDownLeft size={10} /> ارجاع به شما
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          {letter.letterNumber}
                        </span>
                        <div className="flex gap-1.5 items-center">
                          {/* Type Label Badge */}
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              letter.type === "internal"
                                ? "bg-purple-50 text-purple-700 border border-purple-100"
                                : letter.type === "incoming"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}
                          >
                            {letter.type === "internal"
                              ? "داخلی"
                              : letter.type === "incoming"
                                ? "وارده"
                                : "صادره"}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              letter.status === SecretariatLetterStatus.APPROVED
                                ? "bg-emerald-100 text-emerald-800"
                                : letter.status ===
                                    SecretariatLetterStatus.REJECTED
                                  ? "bg-red-100 text-red-800"
                                  : letter.status ===
                                      SecretariatLetterStatus.DRAFT
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {letter.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">
                          {letter.subject}
                        </h4>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pt-1">
                          <span className="truncate">
                            فرستنده: <b>{letter.sender}</b>
                          </span>
                          <span className="truncate">
                            گیرنده: <b>{letter.receiver}</b>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <Calendar size={12} /> {letter.date}
                        </span>
                        {letter.attachments?.length > 0 && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            پیوست: {letter.attachments.length}
                          </span>
                        )}
                        {letter.approvedBy?.length > 0 && (
                          <span
                            className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold"
                            title="امضا شده"
                          >
                            امضا: {letter.approvedBy.length}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-4 items-center">
                        <button
                          onClick={() => setIsPrintMode(letter)}
                          className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline flex items-center gap-0.5"
                        >
                          مشاهده نامه <FileText size={12} />
                        </button>
                        <button
                          onClick={() => setSelectedLetterForView(letter)}
                          className="text-purple-600 hover:text-purple-800 font-bold hover:underline flex items-center gap-0.5"
                        >
                          جزئیات و اقدام <ChevronLeft size={12} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* B. TEMPLATES VIEW */}
      {activeTab === "templates" && (
        <div className="space-y-4 animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={templateSearchTerm}
                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                placeholder="جستجو در عناوین و متن قالب‌های نمونه نامه..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingTemplate({
                    id: generateUUID(),
                    title: "",
                    category: "اداری",
                    content: "",
                    createdAt: Date.now(),
                  });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus size={15} /> افزودن قالب نمونه نامه جدید
              </button>
            </div>
          </div>

          {/* Templates Grid */}
          {templates.filter(
            (t) =>
              !templateSearchTerm ||
              t.title.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
              t.content.toLowerCase().includes(templateSearchTerm.toLowerCase()),
          ).length === 0 ? (
            <div className="glass-panel text-center py-16 px-4 rounded-2xl border border-dashed border-slate-200 bg-white dark:bg-slate-800/50">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-1">
                قالب نمونه نامه‌ای ثبت نشده است
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                شما می‌توانید قالب‌های استاندارد اداری، احکام و صورتجلسات را ایجاد کنید تا در هنگام نگارش نامه به سرعت بارگذاری شوند.
              </p>
              <button
                onClick={() => {
                  setEditingTemplate({
                    id: generateUUID(),
                    title: "",
                    category: "اداری",
                    content: "",
                    createdAt: Date.now(),
                  });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                ایجاد اولین قالب
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates
                .filter(
                  (t) =>
                    !templateSearchTerm ||
                    t.title.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                    t.content.toLowerCase().includes(templateSearchTerm.toLowerCase()),
                )
                .map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b dark:border-slate-700/80 pb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                          {tmpl.category || "عمومی"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTemplate(tmpl)}
                            className="p-1 text-slate-400 hover:text-purple-600 rounded transition-colors"
                            title="ویرایش قالب"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="حذف قالب"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {tmpl.title}
                      </h4>

                      <div
                        className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800"
                        dangerouslySetInnerHTML={{
                          __html: tmpl.content?.replace(/<[^>]*>?/gm, "") || "",
                        }}
                      />
                    </div>

                    <div className="border-t dark:border-slate-700/80 pt-3 flex justify-end">
                      <button
                        onClick={() => {
                          resetForm();
                          const currentDate = getCurrentShamsiDate();
                          setNewLetterForm((prev) => ({
                            ...prev,
                            date: `${currentDate.year}/${String(currentDate.month).padStart(2, "0")}/${String(currentDate.day).padStart(2, "0")}`,
                            subject: tmpl.title,
                            content: tmpl.content,
                          }));
                          setShowNewLetterModal(true);
                        }}
                        className="w-full bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FileCheck size={14} /> استفاده در نگارش نامه جدید
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* C. SETTINGS & CALIBRATION VIEW */}
      {activeTab === "settings" && isSuperUser && (
        <div className="space-y-6 animate-fade-in" dir="rtl">
          {/* Settings Sub-Tab Navigation Bar */}
          <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border dark:border-slate-700 shadow-xs flex items-center gap-1.5 flex-wrap">
            {[
              { id: "permissions", label: "ماتریس دسترسی پرسنل", icon: Shield },
              { id: "numbering", label: "شماره‌گذاری هوشمند خودکار", icon: Hash },
              { id: "letterhead", label: "کالیبراسیون سربرگ و حاشیه‌ها", icon: Ruler },
              { id: "stamp", label: "مهر رسمی شرکت و امضاها", icon: Stamp },
              { id: "word", label: "قالب‌ها و سربرگ ورد", icon: LayoutTemplate },
            ].map((st) => {
              const IconComp = st.icon;
              const isActive = settingsSubTab === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setSettingsSubTab(st.id as any)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                    isActive
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <IconComp size={15} /> {st.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* 1. PERMISSIONS MATRIX */}
            {settingsSubTab === "permissions" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-xs p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b dark:border-slate-700/80 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Shield className="text-purple-600" size={18} />
                      ماتریس تفکیک دسترسی پرسنل دبیرخانه ({selectedCompany?.name})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      در این بخش مشخص کنید کدام پرسنل به بخش دفتر مرکزی یا کارخانه دسترسی داشته باشند و چه کسانی مجاز به ویرایش یا حذف نامه‌ها هستند.
                    </p>
                  </div>

                  <div className="w-full sm:w-64 relative">
                    <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="جستجوی نام پرسنل..."
                      className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Permissions Stats Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                        دسترسی دفتر مرکزی
                      </div>
                      <div className="text-lg font-black text-purple-900 dark:text-purple-100">
                        {toPersianDigits(companySettingsForm.headquartersAccessTokens?.length || 0)} نفر
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = users.map((u) => u.id);
                        const isAll = (companySettingsForm.headquartersAccessTokens || []).length === users.length;
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          headquartersAccessTokens: isAll ? [] : allIds,
                        }));
                      }}
                      className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {(companySettingsForm.headquartersAccessTokens || []).length === users.length ? "لغو همه" : "انتخاب همه"}
                    </button>
                  </div>

                  <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                        دسترسی کارخانه
                      </div>
                      <div className="text-lg font-black text-indigo-900 dark:text-indigo-100">
                        {toPersianDigits(companySettingsForm.factoryAccessTokens?.length || 0)} نفر
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = users.map((u) => u.id);
                        const isAll = (companySettingsForm.factoryAccessTokens || []).length === users.length;
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          factoryAccessTokens: isAll ? [] : allIds,
                        }));
                      }}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {(companySettingsForm.factoryAccessTokens || []).length === users.length ? "لغو همه" : "انتخاب همه"}
                    </button>
                  </div>

                  <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        مجوز ویرایش نامه‌ها
                      </div>
                      <div className="text-lg font-black text-amber-900 dark:text-amber-100">
                        {toPersianDigits(companySettingsForm.editAccessTokens?.length || 0)} نفر
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = users.map((u) => u.id);
                        const isAll = (companySettingsForm.editAccessTokens || []).length === users.length;
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          editAccessTokens: isAll ? [] : allIds,
                        }));
                      }}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {(companySettingsForm.editAccessTokens || []).length === users.length ? "لغو همه" : "انتخاب همه"}
                    </button>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        مجوز حذف نامه‌ها
                      </div>
                      <div className="text-lg font-black text-rose-900 dark:text-rose-100">
                        {toPersianDigits(companySettingsForm.deleteAccessTokens?.length || 0)} نفر
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = users.map((u) => u.id);
                        const isAll = (companySettingsForm.deleteAccessTokens || []).length === users.length;
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          deleteAccessTokens: isAll ? [] : allIds,
                        }));
                      }}
                      className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      {(companySettingsForm.deleteAccessTokens || []).length === users.length ? "لغو همه" : "انتخاب همه"}
                    </button>
                  </div>
                </div>

                {/* Personnel Table */}
                <div className="border dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 border-b dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="p-3 w-1/3">نام و سمت کاربر</th>
                          <th className="p-3 text-center">دسترسی دفتر مرکزی</th>
                          <th className="p-3 text-center">دسترسی کارخانه</th>
                          <th className="p-3 text-center">مجوز ویرایش</th>
                          <th className="p-3 text-center">مجوز حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700">
                        {users
                          .filter(
                            (u) =>
                              !userSearchQuery ||
                              u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              u.role?.toLowerCase().includes(userSearchQuery.toLowerCase()),
                          )
                          .map((u) => {
                            const hasHQ = companySettingsForm.headquartersAccessTokens?.includes(u.id);
                            const hasFC = companySettingsForm.factoryAccessTokens?.includes(u.id);
                            const hasEdit = companySettingsForm.editAccessTokens?.includes(u.id);
                            const hasDel = companySettingsForm.deleteAccessTokens?.includes(u.id);

                            return (
                              <tr
                                key={u.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                              >
                                <td className="p-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-700 dark:text-slate-200 shrink-0">
                                      {u.fullName.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-800 dark:text-white">
                                        {u.fullName}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {u.username} • {u.role || "کاربر"}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* HQ Checkbox */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = companySettingsForm.headquartersAccessTokens || [];
                                      const next = hasHQ
                                        ? current.filter((id) => id !== u.id)
                                        : [...current, u.id];
                                      setCompanySettingsForm((prev) => ({
                                        ...prev,
                                        headquartersAccessTokens: next,
                                      }));
                                    }}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                      hasHQ
                                        ? "bg-purple-600 text-white shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-700 text-transparent border dark:border-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                </td>

                                {/* FC Checkbox */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = companySettingsForm.factoryAccessTokens || [];
                                      const next = hasFC
                                        ? current.filter((id) => id !== u.id)
                                        : [...current, u.id];
                                      setCompanySettingsForm((prev) => ({
                                        ...prev,
                                        factoryAccessTokens: next,
                                      }));
                                    }}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                      hasFC
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-700 text-transparent border dark:border-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                </td>

                                {/* Edit Checkbox */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = companySettingsForm.editAccessTokens || [];
                                      const next = hasEdit
                                        ? current.filter((id) => id !== u.id)
                                        : [...current, u.id];
                                      setCompanySettingsForm((prev) => ({
                                        ...prev,
                                        editAccessTokens: next,
                                      }));
                                    }}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                      hasEdit
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-700 text-transparent border dark:border-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                </td>

                                {/* Delete Checkbox */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = companySettingsForm.deleteAccessTokens || [];
                                      const next = hasDel
                                        ? current.filter((id) => id !== u.id)
                                        : [...current, u.id];
                                      setCompanySettingsForm((prev) => ({
                                        ...prev,
                                        deleteAccessTokens: next,
                                      }));
                                    }}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                      hasDel
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-700 text-transparent border dark:border-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. AUTOMATED NUMBERING ENGINE */}
            {settingsSubTab === "numbering" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-xs p-4 sm:p-6 space-y-6">
                <div className="flex items-center justify-between border-b dark:border-slate-700/80 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Hash className="text-purple-600" size={18} />
                      سیستم شماره‌گذاری هوشمند خودکار نامه‌ها
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      فرمت و ساختار شماره‌گذاری نامه‌ها بر اساس بخش، سال شمسی و شمارنده متوالی تعریف می‌شود.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={companySettingsForm.autoNumberingEnabled ?? true}
                      onChange={(e) =>
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          autoNumberingEnabled: e.target.checked,
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      فعال‌سازی شماره‌گذاری خودکار
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Settings Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        پیشوند دفتر مرکزی (Headquarters Prefix)
                      </label>
                      <input
                        type="text"
                        value={companySettingsForm.numberingPrefixHeadquarters || ""}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            numberingPrefixHeadquarters: e.target.value,
                          }))
                        }
                        placeholder="مثال: HQ یا د-م"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        پیشوند کارخانه (Factory Prefix)
                      </label>
                      <input
                        type="text"
                        value={companySettingsForm.numberingPrefixFactory || ""}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            numberingPrefixFactory: e.target.value,
                          }))
                        }
                        placeholder="مثال: FC یا ک-ت"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        الگوی ساختار شماره نامه (Numbering Pattern)
                      </label>
                      <input
                        type="text"
                        value={companySettingsForm.numberingFormat || ""}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            numberingFormat: e.target.value,
                          }))
                        }
                        placeholder="{PREFIX}-{YEAR}/{NUM}"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400">تگ‌های سریع:</span>
                        {["{PREFIX}", "{YEAR}", "{NUM}", "{SECTION}", "{COMPANY_CODE}"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const cur = companySettingsForm.numberingFormat || "";
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                numberingFormat: cur + tag,
                              }));
                            }}
                            className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border dark:border-slate-600 hover:bg-purple-50"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          شمارنده شروع
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={companySettingsForm.numberingStartCounter ?? 1}
                          onChange={(e) =>
                            setCompanySettingsForm((prev) => ({
                              ...prev,
                              numberingStartCounter: parseInt(e.target.value) || 1,
                            }))
                          }
                          className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs font-mono text-center"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          طول رقم (صفر پرکننده)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={companySettingsForm.numberingPadLength ?? 4}
                          onChange={(e) =>
                            setCompanySettingsForm((prev) => ({
                              ...prev,
                              numberingPadLength: parseInt(e.target.value) || 4,
                            }))
                          }
                          className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Numbering Preview Box */}
                  <div className="bg-slate-50 dark:bg-slate-900/80 border dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Sparkles size={15} className="text-amber-500" />
                        پیش‌نمایش زنده شماره‌گذاری خودکار
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        نمونه شماره‌های تولید شده با توجه به تنظیمات انتخابی شما به شرح زیر خواهند بود:
                      </p>

                      <div className="space-y-2.5 pt-2">
                        <div className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            نامه دفتر مرکزی (HQ):
                          </span>
                          <span className="font-mono text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-800">
                            {getNextLetterNumber(selectedCompany, "headquarters", companySettingsForm)}
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            نامه کارخانه (Factory):
                          </span>
                          <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                            {getNextLetterNumber(selectedCompany, "factory", companySettingsForm)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 font-bold">
                      <CheckCircle size={14} /> شماره‌گذاری متوالی و یکتا به ازای هر شرکت تضمین می‌گردد.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. LETTERHEAD CALIBRATION & MARGIN VISUALIZER */}
            {settingsSubTab === "letterhead" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-xs p-4 sm:p-6 space-y-6">
                <div className="border-b dark:border-slate-700/80 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Ruler className="text-purple-600" size={18} />
                      کالیبراسیون میلی‌متری سربرگ و فواصل چاپ و PDF
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      حاشیه‌های متن و موقعیت دقیق شماره/تاریخ را با پیش‌نمایش بلادرنگ تنظیم کنید تا در چاپ و خروجی PDF بدون کمترین خطا بنشیند.
                    </p>
                  </div>

                  {/* Letterhead Upload Actions */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={letterheadInputRef}
                      onChange={handleLetterheadUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => letterheadInputRef.current?.click()}
                      disabled={uploadingLetterhead}
                      className="bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      {uploadingLetterhead ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      آپلود تصویر سربرگ شرکت
                    </button>

                    {companySettingsForm.letterheadUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            letterheadUrl: "",
                          }))
                        }
                        className="text-red-500 hover:text-red-700 text-xs font-bold p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                        title="حذف تصویر سربرگ"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Interactive Live Preview Sheet (5 Cols) */}
                  <div className="lg:col-span-5 bg-slate-100 dark:bg-slate-900/90 p-4 rounded-2xl border dark:border-slate-700 flex flex-col items-center justify-center space-y-3">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Eye size={13} /> شبیه‌ساز برگه چاپ A4 (مقیاس زنده)
                    </div>

                    {/* Miniature A4 Sheet (210 x 297 ratio) */}
                    <div
                      className="w-[260px] h-[368px] bg-white border border-slate-300 shadow-md relative overflow-hidden rounded text-right select-none"
                      style={{
                        fontFamily: companySettingsForm.letterheadFontFamily || "sans-serif",
                      }}
                    >
                      {/* Letterhead Background if uploaded */}
                      {companySettingsForm.letterheadUrl ? (
                        <img
                          src={companySettingsForm.letterheadUrl}
                          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                        />
                      ) : (
                        /* Default Minimal Corporate Header simulation */
                        <div className="p-3 border-b border-slate-200 flex justify-between items-center text-[8px] text-slate-600 font-bold">
                          <span>{selectedCompany.name}</span>
                          <span className="text-[7px]">دبیرخانه مرکزی</span>
                        </div>
                      )}

                      {/* Metadata Box Guide */}
                      <div
                        className="absolute border border-blue-400 bg-blue-50/70 p-1 rounded z-20"
                        style={{
                          top: `${((companySettingsForm.metadataTop ?? 25) / 297) * 100}%`,
                          left: `${((companySettingsForm.metadataLeft ?? 20) / 210) * 100}%`,
                          fontSize: `${Math.max(6, (companySettingsForm.metadataFontSize ?? 11) * 0.55)}px`,
                          color: companySettingsForm.metadataColor || "#0f172a",
                          fontWeight: companySettingsForm.metadataFontWeight || "bold",
                          lineHeight: "1.2",
                          transform: "translate(0, 0)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div>شماره: ۱۴۰۴/۰۱</div>
                        <div>تاریخ: ۱۴۰۴/۰۴/۰۶</div>
                        <div>پیوست: ندارد</div>
                      </div>

                      {/* Body Content Simulation Area */}
                      <div
                        className="absolute border border-dashed border-red-300 bg-red-50/10 flex flex-col justify-between overflow-hidden"
                        style={{
                          top: `${((companySettingsForm.marginTop ?? 40) / 297) * 100}%`,
                          bottom: `${((companySettingsForm.marginBottom ?? 25) / 297) * 100}%`,
                          left: `${((companySettingsForm.marginLeft ?? 20) / 210) * 100}%`,
                          right: `${((companySettingsForm.marginRight ?? 20) / 210) * 100}%`,
                        }}
                      >
                        <div className="p-1 space-y-1 text-[7px] text-slate-600 leading-tight">
                          <div className="font-bold">موضوع: نامه اداری</div>
                          <div>با سلام و احترام،</div>
                          <div className="text-justify text-slate-400 text-[6px]">
                            متن نامه اداری دقیقا در این محدوده با رعایت حاشیه‌های سربرگ نمایش داده خواهد شد...
                          </div>
                        </div>

                        {/* Stamp simulation */}
                        {companySettingsForm.companyStampUrl && (
                          <div
                            className={`p-1 flex ${
                              companySettingsForm.companyStampPosition === "bottom_left"
                                ? "justify-start"
                                : companySettingsForm.companyStampPosition === "bottom_center"
                                  ? "justify-center"
                                  : "justify-end"
                            }`}
                          >
                            <img
                              src={companySettingsForm.companyStampUrl}
                              className="w-8 h-8 object-contain mix-blend-multiply"
                              style={{
                                opacity: (companySettingsForm.companyStampOpacity ?? 75) / 100,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center">
                      مستطیل قرمز = محدوده متن | کادر آبی = مشخصات نامه
                    </div>
                  </div>

                  {/* Right Column: Calibration Controls (7 Cols) */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* 1. Page Margins */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border dark:border-slate-700">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">
                        حاشیه‌های متن نامه از لبه‌های برگه (میلی‌متر)
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>حاشیه بالا (فاصله از سربرگ):</span>
                            <span className="font-mono text-purple-600 font-black">
                              {companySettingsForm.marginTop ?? 40} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="120"
                            value={companySettingsForm.marginTop ?? 40}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                marginTop: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>حاشیه پایین صفحه:</span>
                            <span className="font-mono text-purple-600 font-black">
                              {companySettingsForm.marginBottom ?? 25} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="70"
                            value={companySettingsForm.marginBottom ?? 25}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                marginBottom: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>حاشیه راست متن:</span>
                            <span className="font-mono text-purple-600 font-black">
                              {companySettingsForm.marginRight ?? 20} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="50"
                            value={companySettingsForm.marginRight ?? 20}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                marginRight: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-purple-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>حاشیه چپ متن:</span>
                            <span className="font-mono text-purple-600 font-black">
                              {companySettingsForm.marginLeft ?? 20} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="50"
                            value={companySettingsForm.marginLeft ?? 20}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                marginLeft: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-purple-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Metadata Block Coordinates & Typography */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border dark:border-slate-700">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">
                        موقعیت و قلم مشخصات سربرگ (شماره، تاریخ، پیوست)
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>فاصله از بالای سربرگ:</span>
                            <span className="font-mono text-blue-600 font-black">
                              {companySettingsForm.metadataTop ?? 25} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="80"
                            value={companySettingsForm.metadataTop ?? 25}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                metadataTop: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>فاصله از چپ سربرگ:</span>
                            <span className="font-mono text-blue-600 font-black">
                              {companySettingsForm.metadataLeft ?? 20} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="80"
                            value={companySettingsForm.metadataLeft ?? 20}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                metadataLeft: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>اندازه فونت مشخصات:</span>
                            <span className="font-mono text-blue-600 font-black">
                              {companySettingsForm.metadataFontSize ?? 11} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="8"
                            max="18"
                            value={companySettingsForm.metadataFontSize ?? 11}
                            onChange={(e) =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                metadataFontSize: parseInt(e.target.value),
                              }))
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            رنگ فونت مشخصات
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={companySettingsForm.metadataColor || "#0f172a"}
                              onChange={(e) =>
                                setCompanySettingsForm((prev) => ({
                                  ...prev,
                                  metadataColor: e.target.value,
                                }))
                              }
                              className="w-8 h-8 rounded border dark:border-slate-700 cursor-pointer p-0.5"
                            />
                            <span className="text-xs font-mono">
                              {companySettingsForm.metadataColor || "#0f172a"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. COMPANY STAMP & SIGNATURE CONFIGURATION */}
            {settingsSubTab === "stamp" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-xs p-4 sm:p-6 space-y-6">
                <div className="border-b dark:border-slate-700/80 pb-4">
                  <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Stamp className="text-purple-600" size={18} />
                    تنظیمات مهر رسمی شرکت و جایگاه امضاها
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    تصویر مهر حقوقی شرکت را آپلود کرده و اندازه، شفافیت و جایگاه پیش‌فرض آن را تعیین کنید.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Stamp Upload & Controls */}
                  <div className="space-y-4">
                    <div className="p-4 border dark:border-slate-700 rounded-xl space-y-3 bg-slate-50 dark:bg-slate-900/60">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        تصویر مهر رسمی شرکت (PNG بدون پس‌زمینه)
                      </label>
                      <input
                        type="file"
                        ref={stampInputRef}
                        onChange={handleStampUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stampInputRef.current?.click()}
                          disabled={uploadingStamp}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          {uploadingStamp ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          انتخاب و آپلود تصویر مهر
                        </button>
                        {companySettingsForm.companyStampUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setCompanySettingsForm((prev) => ({
                                ...prev,
                                companyStampUrl: "",
                              }))
                            }
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-xl text-xs font-bold"
                          >
                            حذف مهر
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>اندازه مهر در چاپ:</span>
                        <span className="font-mono text-purple-600 font-black">
                          {companySettingsForm.companyStampSize ?? 120} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="220"
                        value={companySettingsForm.companyStampSize ?? 120}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            companyStampSize: parseInt(e.target.value),
                          }))
                        }
                        className="w-full accent-purple-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>شفافیت مهر (Opacity):</span>
                        <span className="font-mono text-purple-600 font-black">
                          {companySettingsForm.companyStampOpacity ?? 75}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={companySettingsForm.companyStampOpacity ?? 75}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            companyStampOpacity: parseInt(e.target.value),
                          }))
                        }
                        className="w-full accent-purple-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        جایگاه پیش‌فرض مهر در زیر نامه
                      </label>
                      <select
                        value={companySettingsForm.companyStampPosition || "bottom_left"}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            companyStampPosition: e.target.value as any,
                          }))
                        }
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs"
                      >
                        <option value="bottom_left">پایین چپ (استاندارد اداری)</option>
                        <option value="bottom_center">پایین وسط</option>
                        <option value="bottom_right">پایین راست</option>
                      </select>
                    </div>
                  </div>

                  {/* Stamp Live Preview */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border dark:border-slate-700 flex flex-col items-center justify-center space-y-3 min-h-[260px]">
                    <div className="text-xs font-bold text-slate-500">پیش‌نمایش مهر رسمی</div>
                    {companySettingsForm.companyStampUrl ? (
                      <div className="p-4 bg-white dark:bg-slate-800 border rounded-2xl shadow-inner flex items-center justify-center">
                        <img
                          src={companySettingsForm.companyStampUrl}
                          className="object-contain mix-blend-multiply"
                          style={{
                            height: `${companySettingsForm.companyStampSize ?? 120}px`,
                            width: `${companySettingsForm.companyStampSize ?? 120}px`,
                            opacity: (companySettingsForm.companyStampOpacity ?? 75) / 100,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 text-center">
                        هنوز تصویری برای مهر آپلود نشده است.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. WORD & TEMPLATES SETTINGS */}
            {settingsSubTab === "word" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-xs p-4 sm:p-6 space-y-6">
                <div className="border-b dark:border-slate-700/80 pb-4">
                  <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <LayoutTemplate className="text-purple-600" size={18} />
                    قالب‌ها، سربرگ فایل ورد و فونت پیش‌فرض
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    تنظیم سربرگ خروجی Word (.docx) و متن پیش‌فرض صورتجلسات اداری این شرکت.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        فونت پیش‌فرض متن نامه‌ها و چاپ
                      </label>
                      <select
                        value={companySettingsForm.letterheadFontFamily || "Vazirmatn"}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            letterheadFontFamily: e.target.value,
                          }))
                        }
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl px-3 py-2 text-xs"
                      >
                        <option value="Vazirmatn">وزیرمتن (Vazirmatn - استاندارد رسمی)</option>
                        <option value="Shabnam">شبنم (Shabnam)</option>
                        <option value="Sahel">ساحل (Sahel)</option>
                        <option value="Gandom">گندم (Gandom)</option>
                        <option value="Estedad">استعداد (Estedad)</option>
                        <option value="Samim">صمیم (Samim)</option>
                        <option value="Tanha">تنها (Tanha)</option>
                        <option value="Tahoma">تاهوما (Tahoma)</option>
                        <option value="Arial">آریال (Arial)</option>
                      </select>
                    </div>

                    <div className="p-4 border dark:border-slate-700 rounded-xl space-y-3 bg-slate-50 dark:bg-slate-900/60">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        فایل سربرگ اختصاصی خروجی ورد (.docx)
                      </label>
                      <input
                        type="file"
                        ref={wordLetterheadInputRef}
                        onChange={handleWordLetterheadUpload}
                        accept=".docx"
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => wordLetterheadInputRef.current?.click()}
                          disabled={uploadingWordLetterhead}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          {uploadingWordLetterhead ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          آپلود فایل سربرگ Word (.docx)
                        </button>
                        {companySettingsForm.wordLetterheadUrl && (
                          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle size={13} /> فایل فعال است
                          </span>
                        )}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={companySettingsForm.hideAutoFooter || false}
                        onChange={(e) =>
                          setCompanySettingsForm((prev) => ({
                            ...prev,
                            hideAutoFooter: e.target.checked,
                          }))
                        }
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        عدم درج خودکار آدرس و شماره ثبت در پاورقی (هنگام استفاده از سربرگ کامل)
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      قالب متن پیش‌فرض صورتجلسات این شرکت
                    </label>
                    <textarea
                      rows={8}
                      value={companySettingsForm.meetingMinutesTemplate || ""}
                      onChange={(e) =>
                        setCompanySettingsForm((prev) => ({
                          ...prev,
                          meetingMinutesTemplate: e.target.value,
                        }))
                      }
                      placeholder="متن ساختار استاندارد صورتجلسات هیئت مدیره یا جلسات داخلی..."
                      className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-xl p-3 text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STICKY SAVE BAR */}
            <div className="sticky bottom-4 z-30 bg-slate-900/90 text-white p-3 sm:p-4 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between gap-4 border border-slate-700">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>تنظیمات برای <b>{selectedCompany?.name}</b> ذخیره خواهد شد.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Save size={16} /> ذخیره کلیه تنظیمات، دسترسی‌ها و کالیبراسیون
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- ALL MODALS --- */}

      {/* 1. REGISTER NEW LETTER MODAL */}
      <AnimatePresence>
        {showNewLetterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-1 sm:p-3 backdrop-blur-xs overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-slate-100 dark:bg-slate-900 w-full h-full max-w-[1500px] rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col overflow-hidden text-right shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <h3 className="text-sm sm:text-base font-black text-gray-800 dark:text-white">
                    {newLetterForm.id ? "ویرایش نامه اداری" : "ثبت و تدوین نامه اداری جدید"}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                    {selectedCompany?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const fakeLetter: SecretariatLetter = {
                        ...(newLetterForm as any),
                        id: "preview_only",
                        companyId: selectedCompany.id,
                        status: SecretariatLetterStatus.DRAFT,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        letterNumber: "پیش‌نویس",
                        date: newLetterForm.date || "پیش‌نویس",
                      };
                      setIsPrintMode(fakeLetter);
                    }}
                    className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <Eye size={13} /> مشاهده پیش‌نویس
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewLetterModal(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveLetter} className="flex-1 flex flex-col overflow-hidden gap-2 min-h-0 pt-2">
                {/* Compact Metadata Ribbon */}
                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700/80 rounded-xl p-2.5 shadow-xs shrink-0 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 items-center">
                    {/* Subject */}
                    <div className="md:col-span-4 space-y-0.5">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                        <span>موضوع نامه</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={newLetterForm.subject}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            subject: e.target.value,
                          })
                        }
                        placeholder="مثال: درخواست تأمین تجهیزات حفاظتی"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* Sender */}
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">فرستنده (از طرف)</label>
                      <input
                        required
                        type="text"
                        list="user-list"
                        value={newLetterForm.sender}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            sender: e.target.value,
                          })
                        }
                        placeholder="مثال: مدیریت دفتر مرکزی"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2.5 py-1 text-xs"
                      />
                    </div>

                    {/* Receiver */}
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">گیرنده (به سمت)</label>
                      <input
                        required
                        type="text"
                        list="user-list"
                        value={newLetterForm.receiver}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            receiver: e.target.value,
                          })
                        }
                        placeholder="مثال: سرپرست کارخانه"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2.5 py-1 text-xs"
                      />
                    </div>

                    {/* Type */}
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">نوع نامه</label>
                      <select
                        value={newLetterForm.type}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2 py-1 text-xs bg-white dark:text-white"
                      >
                        <option value="internal">داخلی (بین‌بخشی)</option>
                        <option value="incoming">وارده (سازمان بیرونی)</option>
                        <option value="outgoing">صادره (سازمان بیرونی)</option>
                      </select>
                    </div>

                    {/* Date */}
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">تاریخ نامه (شمسی)</label>
                      <input
                        required
                        type="text"
                        value={newLetterForm.date}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            date: e.target.value,
                          })
                        }
                        placeholder="۱۴۰۵/۰۴/۰۶"
                        className="w-full border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2 py-1 text-xs font-mono text-center"
                      />
                    </div>

                    <datalist id="user-list">
                      {users.map((u) => (
                        <option key={u.id} value={u.fullName} />
                      ))}
                    </datalist>
                  </div>

                  {/* Inline quick checkboxes and advanced settings trigger */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t dark:border-slate-700/60 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newLetterForm.hideSubjectInLetter}
                          onChange={(e) =>
                            setNewLetterForm({
                              ...newLetterForm,
                              hideSubjectInLetter: e.target.checked,
                            })
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                        />
                        حذف موضوع از متن
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newLetterForm.hideSalutationInLetter}
                          onChange={(e) =>
                            setNewLetterForm({
                              ...newLetterForm,
                              hideSalutationInLetter: e.target.checked,
                            })
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                        />
                        حذف عبارت «با سلام و احترام»
                      </label>
                      {companySettingsForm.companyStampUrl && (
                        <label className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newLetterForm.addCompanyStamp}
                            onChange={(e) =>
                              setNewLetterForm({
                                ...newLetterForm,
                                addCompanyStamp: e.target.checked,
                              })
                            }
                            className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                          />
                          درج مهر شرکت
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-[11px] text-purple-600 dark:text-purple-400 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newLetterForm.isPrivate}
                          onChange={(e) =>
                            setNewLetterForm({
                              ...newLetterForm,
                              isPrivate: e.target.checked,
                            })
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                        />
                        نامه محرمانه
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedOptionsModal(true)}
                        className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                      >
                        <Sliders size={13} />
                        تنظیمات تکمیلی، امضاها و ضمائم ({newLetterForm.attachments?.length || 0} پیوست)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Virtual Google Docs Workspace Canvas - Maximized Height */}
                <div className="flex-1 min-h-0 flex flex-col bg-slate-200/90 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-inner">
                  {/* Google Docs Styled Menu Bar */}
                  <div className="flex items-center flex-wrap gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 select-none relative z-40 shrink-0">
                    {/* Doc Icon & Subject */}
                    <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-700 pl-3 ml-1 text-purple-600 dark:text-purple-400">
                      <FileText size={15} />
                      <span className="truncate max-w-[150px]">
                        {newLetterForm.subject || "پیش‌نویس بدون نام"}
                      </span>
                    </div>

                    {/* File Menu */}
                    <div className="relative">
                      <input
                        type="file"
                        accept=".docx"
                        ref={docxImportInputRef}
                        onChange={handleDocxImport}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === "file" ? null : "file");
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "file" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        پرونده
                      </button>
                      {activeMenu === "file" && (
                        <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveLetter();
                              setActiveMenu(null);
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between font-bold text-blue-600 dark:text-blue-400"
                          >
                            <span>ذخیره پیش‌نویس</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ctrl+S
                            </span>
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={() => docxImportInputRef.current?.click()}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold"
                          >
                            <span>وارد کردن متن از فایل Word</span>
                            <Upload size={12} className="text-emerald-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              window.print();
                              setActiveMenu(null);
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>چاپ سند</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ctrl+P
                            </span>
                          </button>

                          {editingLetterId && (
                            <>
                              <hr className="my-1 border-slate-100 dark:border-slate-700" />
                              <a
                                href={`/api/secretariat/letters/${editingLetterId}/pdf`}
                                className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-rose-600 font-bold"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setActiveMenu(null)}
                              >
                                <span>دانلود خروجی PDF</span>
                                <FileText size={12} className="text-rose-500" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  openSendToChat({
                                    fileUrl: `/api/secretariat/letters/${editingLetterId}/pdf`,
                                    fileName: `Letter_${editingLetterId}.pdf`,
                                    title: "ارسال فایل PDF نامه به گفتگو",
                                    defaultMessage: `📄 فایل PDF نامه اداری: ${newLetterForm.subject || 'نامه رسمی'}`
                                  });
                                  setActiveMenu(null);
                                }}
                                className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-emerald-600 font-bold cursor-pointer"
                              >
                                <span>ارسال فایل PDF به گفتگو</span>
                                <MessageSquare size={12} className="text-emerald-500" />
                              </button>
                              <a
                                href={`/api/secretariat/letters/${editingLetterId}/word`}
                                className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-indigo-600 font-bold"
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setActiveMenu(null)}
                              >
                                <span>دانلود خروجی Word</span>
                                <FileText
                                  size={12}
                                  className="text-indigo-500"
                                />
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (!newLetterForm.content) {
                                alert("ابتدا متنی در سند بنویسید.");
                                return;
                              }
                              const title = prompt(
                                "لطفا عنوانی برای این قالب نمونه نامه وارد کنید:",
                                newLetterForm.subject || "قالب جدید",
                              );
                              if (!title) return;

                              handleSaveTemplate({
                                title: title,
                                subject: newLetterForm.subject || "",
                                content: newLetterForm.content,
                                category: "اداری",
                              });
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-purple-600 dark:text-purple-400 font-bold"
                          >
                            <span>ذخیره به عنوان نمونه نامه</span>
                            <Save size={12} className="text-purple-500" />
                          </button>

                          <hr className="my-1 border-slate-100 dark:border-slate-700" />

                          <button
                            type="button"
                            onClick={handleInsertMinutesTemplate}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>درج قالب صورتجلسه پیش‌فرض</span>
                            <FileCheck size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNewLetterForm({
                                ...newLetterForm,
                                content: "",
                              })
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-red-600 dark:text-red-400"
                          >
                            <span>پاک کردن کل متن سند</span>
                            <Trash2 size={12} className="text-red-400" />
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={() => setShowNewLetterModal(false)}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>خروج و بستن ویرایشگر</span>
                            <X size={12} className="text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Edit Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === "edit" ? null : "edit");
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "edit" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        ویرایش
                      </button>
                      {activeMenu === "edit" && (
                        <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={handleUndo}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>واگرد (Undo)</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ctrl+Z
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRedo}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>مجدد (Redo)</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ctrl+Y
                            </span>
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>انتخاب همه متن</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ctrl+A
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClearFormatting}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>پاک کردن قالب‌بندی‌ها</span>
                            <Trash2 size={12} className="text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Insert Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(
                            activeMenu === "insert" ? null : "insert",
                          );
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "insert" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        درج
                      </button>
                      {activeMenu === "insert" && (
                        <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                '<p style="text-align:right; font-weight:bold;">با سلام و احترام،</p><p style="text-align:justify;">بازگشت به نامه شماره ... مورخ ... به استحضار می‌رساند؛ </p>',
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>شروع رسمی نامه (با سلام و احترام)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                '<p style="text-align:right; font-weight:bold; margin-top:20px;">با تجدید احترام</p><p style="text-align:right; margin-bottom:20px;">مدیریت ...</p>',
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>پایان رسمی نامه (با تجدید احترام)</span>
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={() => {
                              const url = prompt(
                                "لطفا آدرس اینترنتی (URL) تصویر را وارد کنید:",
                              );
                              if (url)
                                insertHTML(
                                  `<img src="${url}" style="max-width:100%; border-radius:8px;" />`,
                                );
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>تصویر (از لینک)</span>
                            <FileText size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const quill = quillRef.current?.getEditor();
                              if (quill && quill.getModule("table")) {
                                quill.getModule("table").insertTable(3, 3);
                              } else {
                                insertHTML(
                                  '<table style="width:100%; border-collapse:collapse; margin:10px 0;"><tr style="background:#f8fafc;"><th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">ردیف</th><th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">عنوان</th><th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">توضیحات</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">۱</td><td style="border:1px solid #cbd5e1; padding:8px;"></td><td style="border:1px solid #cbd5e1; padding:8px;"></td></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">۲</td><td style="border:1px solid #cbd5e1; padding:8px;"></td><td style="border:1px solid #cbd5e1; padding:8px;"></td></tr></table>',
                                );
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>جدول اداری خام</span>
                            <Award size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                '<hr style="border:0; border-top:1px solid #cbd5e1; margin:15px 0;" />',
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>خط افقی جداکننده</span>
                            <span className="text-[10px] text-slate-400">
                              ---
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                '<br style="page-break-after: always; break-after: page;" />',
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>شکست صفحه (Page Break)</span>
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                `<b>تاریخ: ${newLetterForm.date || getCurrentShamsiDate()}</b>`,
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>تاریخ امروز</span>
                            <Calendar size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertHTML(
                                `<p style="text-align:left; margin-top:30px; font-weight:bold;">امضای: ${newLetterForm.sender || "فرستنده"}</p>`,
                              )
                            }
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>امضای فرستنده</span>
                            <UserCheck size={12} className="text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Format Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(
                            activeMenu === "format" ? null : "format",
                          );
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "format" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        قالب‌بندی
                      </button>
                      {activeMenu === "format" && (
                        <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              insertHTML('<div style="line-height: 1.0;">'); // Not perfect but triggers format
                              if (quillRef.current) {
                                const q = quillRef.current.getEditor();
                                q.formatLine(
                                  0,
                                  q.getLength(),
                                  "lineHeight",
                                  "1.0",
                                );
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>فاصله خطوط: تک (1.0)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (quillRef.current) {
                                const q = quillRef.current.getEditor();
                                q.formatLine(
                                  0,
                                  q.getLength(),
                                  "lineHeight",
                                  "1.5",
                                );
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>فاصله خطوط: 1.5</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (quillRef.current) {
                                const q = quillRef.current.getEditor();
                                q.formatLine(
                                  0,
                                  q.getLength(),
                                  "lineHeight",
                                  "2.0",
                                );
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>فاصله خطوط: دو (2.0)</span>
                          </button>
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button
                            type="button"
                            onClick={() => {
                              if (quillRef.current) {
                                const q = quillRef.current.getEditor();
                                q.format("align", "justify");
                              }
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>تراز دوطرفه (Justify)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tools Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(
                            activeMenu === "tools" ? null : "tools",
                          );
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "tools" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        ابزارها
                      </button>
                      {activeMenu === "tools" && (
                        <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const cleanText = (newLetterForm.content || "")
                                .replace(/<[^>]*>/g, "")
                                .trim();
                              const wCount = cleanText
                                ? cleanText.split(/\s+/).length
                                : 0;
                              const cCount = cleanText.length;
                              const minutes = Math.ceil(wCount / 180);
                              alert(
                                `آمار نگارش سند:\n\nتعداد کلمات: ${wCount} کلمه\nتعداد حروف: ${cCount} کاراکتر\nزمان تخمینی مطالعه: ${minutes} دقیقه`,
                              );
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>شمارش کلمات</span>
                            <FileText size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowFindReplace(!showFindReplace)}
                            className="w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>جستجو و جایگزینی (Find)</span>
                            <Edit size={12} className="text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={handleTTS}
                            className={`w-full text-right px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${isReadingAloud ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 font-bold" : ""}`}
                          >
                            <span>
                              {isReadingAloud
                                ? "توقف خوانش صوتی"
                                : "خوانش صوتی با هوش مصنوعی"}
                            </span>
                            <Volume2
                              size={12}
                              className={
                                isReadingAloud
                                  ? "text-indigo-600"
                                  : "text-slate-400"
                              }
                            />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Help Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === "help" ? null : "help");
                        }}
                        className={`px-3 py-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 ${activeMenu === "help" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
                      >
                        راهنما
                      </button>
                      {activeMenu === "help" && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-2xl py-2 px-3 text-right text-[11px] z-50 text-slate-800 dark:text-slate-200 space-y-1.5 leading-relaxed">
                          <h5 className="font-black text-purple-700 dark:text-purple-400 border-b dark:border-slate-700 pb-1">
                            نکات نگارش رسمی و سازمانی
                          </h5>
                          <p>
                            ۱. جملات کوتاه، شفاف و عاری از کلمات مبهم بنویسید.
                          </p>
                          <p>
                            ۲. همواره لحن محترمانه و قاطع اداری را حفظ نمایید.
                          </p>
                          <p>
                            ۳. برای تراز بندی پاراگراف‌ها از کلیدهای چینش متن
                            استفاده کنید.
                          </p>
                          <p>
                            ۴. پیش از ارسال، آمار شمارش کلمات و غلط‌یابی املایی
                            را چک کنید.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Letter Templates Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(
                            activeMenu === "templates" ? null : "templates",
                          );
                        }}
                        className={`px-3 py-1 rounded-md text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition flex items-center gap-1 font-extrabold ${activeMenu === "templates" ? "bg-purple-100 dark:bg-purple-950/50" : ""}`}
                      >
                        <FileText size={13} /> نمونه نامه‌ها (بانک قالب‌ها)
                      </button>
                      {activeMenu === "templates" && (
                        <div className="absolute left-0 sm:right-0 mt-1.5 w-64 bg-white dark:bg-slate-800 border border-purple-100 dark:border-white/10 rounded-lg shadow-2xl py-1 text-right text-xs z-50 text-slate-800 dark:text-slate-200 max-h-80 overflow-y-auto">
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-[10px] text-slate-500 font-bold space-y-1">
                            <div>نمونه نامه‌ها و نامه‌های پیشین:</div>
                            <input
                              type="text"
                              value={templateSearchTerm}
                              onChange={(e) =>
                                setTemplateSearchTerm(e.target.value)
                              }
                              placeholder="جستجوی قالب یا نامه..."
                              className="w-full text-xs p-1.5 border rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-400"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Render Templates */}
                          {templates
                            .filter(
                              (t) =>
                                !templateSearchTerm ||
                                t.title.includes(templateSearchTerm) ||
                                (t.subject &&
                                  t.subject.includes(templateSearchTerm)),
                            )
                            .map((temp) => (
                              <button
                                key={`tpl-${temp.id}`}
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `آیا مطمئن هستید که می‌خواهید متن قالب "${temp.title}" را در سند فعلی درج کنید؟ (متن قبلی جایگزین می‌شود)`,
                                    )
                                  ) {
                                    setNewLetterForm((prev) => ({
                                      ...prev,
                                      subject:
                                        temp.subject ||
                                        prev.subject ||
                                        temp.title,
                                      content: temp.content,
                                    }));
                                    setActiveMenu(null);
                                  }
                                }}
                                className="w-full text-right px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/30 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-0.5 transition-colors"
                              >
                                <span className="font-bold text-purple-700 dark:text-purple-400">
                                  [قالب] {temp.title}
                                </span>
                                {temp.subject && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                                    موضوع: {temp.subject}
                                  </span>
                                )}
                              </button>
                            ))}

                          {/* Render Past Letters as Templates (Only if there is a search term to avoid huge list) */}
                          {templateSearchTerm &&
                            letters
                              .filter(
                                (l) => l.companyId === selectedCompany?.id,
                              )
                              .filter(
                                (l) =>
                                  l.subject?.includes(templateSearchTerm) ||
                                  l.letterNumber?.includes(
                                    templateSearchTerm,
                                  ) ||
                                  l.receiver?.includes(templateSearchTerm),
                              )
                              .map((l) => (
                                <button
                                  key={`let-${l.id}`}
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `آیا مطمئن هستید که می‌خواهید محتوای نامه "${l.subject}" را در سند فعلی درج کنید؟ (متن قبلی جایگزین می‌شود)`,
                                      )
                                    ) {
                                      setNewLetterForm((prev) => ({
                                        ...prev,
                                        subject: l.subject,
                                        content: l.content,
                                        receiver: l.receiver,
                                      }));
                                      setActiveMenu(null);
                                    }
                                  }}
                                  className="w-full text-right px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-b border-slate-50 dark:border-slate-700/50 flex flex-col gap-0.5 transition-colors"
                                >
                                  <span className="font-bold text-blue-700 dark:text-blue-400">
                                    [نامه ${toPersianDigits(l.letterNumber)}]{" "}
                                    {l.subject}
                                  </span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                                    به: {l.receiver}
                                  </span>
                                </button>
                              ))}

                          {templates.length === 0 && !templateSearchTerm && (
                            <div className="px-4 py-3 text-slate-400 text-center text-[11px]">
                              هیچ قالب نمونه نامه‌ای تعریف نشده است.
                              <br />
                              برای جستجوی نامه‌های پیشین، عبارت مورد نظر را تایپ
                              کنید.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick zoom controls on the left */}
                    <div className="mr-auto flex items-center gap-1.5 bg-white dark:bg-slate-900 border dark:border-white/10 px-2 py-0.5 rounded-lg text-xs">
                      <span className="text-[10px] text-slate-400 font-bold">
                        بزرگنمایی صفحه:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditorZoom((prev) => Math.max(80, prev - 10))
                        }
                        className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-black text-sm"
                        title="کوچک‌نمایی"
                      >
                        -
                      </button>
                      <span className="font-bold font-mono text-[10px] min-w-[30px] text-center dark:text-white">
                        {editorZoom}%
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditorZoom((prev) => Math.min(200, prev + 10))
                        }
                        className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-black text-sm"
                        title="بزرگ‌نمایی"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Find & Replace Bar */}
                  {showFindReplace && (
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-slate-800 border-x border-b dark:border-white/10 rounded-b-lg text-xs animate-slide-down">
                      <div className="flex items-center gap-1.5">
                        <label className="text-slate-400 font-bold">
                          جستجو:
                        </label>
                        <input
                          type="text"
                          value={findText}
                          onChange={(e) => setFindText(e.target.value)}
                          placeholder="کلمه مورد نظر..."
                          className="border dark:border-white/10 dark:bg-slate-900 rounded px-2 py-1 text-xs w-36"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-slate-400 font-bold">
                          جایگزینی با:
                        </label>
                        <input
                          type="text"
                          value={replaceText}
                          onChange={(e) => setReplaceText(e.target.value)}
                          placeholder="کلمه جدید..."
                          className="border dark:border-white/10 dark:bg-slate-900 rounded px-2 py-1 text-xs w-36"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleFindReplace}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded"
                      >
                        جایگزینی همه موارد
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFindReplace(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        لغو
                      </button>
                    </div>
                  )}

                  {/* Virtual Google Docs Workspace Canvas */}
                  <div className="bg-slate-100 dark:bg-slate-950 p-6 md:p-8 rounded-b-xl border border-slate-200 dark:border-slate-800 max-h-[550px] overflow-y-auto flex justify-center w-full relative">
                    <div
                      className="bg-white dark:bg-gray-900 shadow-xl border border-slate-300 dark:border-slate-800 rounded-sm p-[1.5cm] mx-auto transition-all duration-300 google-docs-paper text-right relative flex flex-col justify-between"
                      style={{
                        width:
                          newLetterForm.paperSize === "A5"
                            ? newLetterForm.orientation === "landscape"
                              ? "100%"
                              : "148mm"
                            : newLetterForm.orientation === "landscape"
                              ? "100%"
                              : "210mm",
                        minHeight:
                          newLetterForm.paperSize === "A5"
                            ? newLetterForm.orientation === "landscape"
                              ? "148mm"
                              : "210mm"
                            : newLetterForm.orientation === "landscape"
                              ? "210mm"
                              : "297mm",
                        fontSize: `${14 * (editorZoom / 100)}px`,
                      }}
                      dir="rtl"
                    >
                      {(() => {
                        const cleanText = (newLetterForm.content || "")
                          .replace(/<[^>]*>/g, "")
                          .trim();
                        const wCount = cleanText
                          ? cleanText.split(/\s+/).length
                          : 0;
                        const cCount = cleanText.length;
                        return (
                          <>
                            <ReactQuill
                              ref={quillRef}
                              theme="snow"
                              value={newLetterForm.content}
                              onChange={(val) =>
                                setNewLetterForm({
                                  ...newLetterForm,
                                  content: val,
                                })
                              }
                              placeholder="متن رسمی و اداری خود را اینجا بنویسید..."
                              className="text-sm border-none ql-editor-borderless flex-1"
                              modules={{
                                toolbar: [
                                  [
                                    {
                                      font: [
                                        "Vazirmatn",
                                        "Shabnam",
                                        "Sahel",
                                        "Gandom",
                                        "Estedad",
                                        "Samim",
                                        "Tanha",
                                        "Tahoma",
                                        "Arial",
                                        "Times New Roman",
                                        "Courier New",
                                      ],
                                    },
                                    {
                                      size: [
                                        "9px",
                                        "10px",
                                        "11px",
                                        "12px",
                                        "13px",
                                        "14px",
                                        "15px",
                                        "16px",
                                        "17px",
                                        "18px",
                                        "19px",
                                        "20px",
                                        "22px",
                                        "24px",
                                        "28px",
                                        "32px",
                                        "36px",
                                        "48px",
                                      ],
                                    },
                                  ],
                                  [{ header: [1, 2, 3, 4, 5, 6, false] }],
                                  ["bold", "italic", "underline", "strike"],
                                  [{ color: [] }, { background: [] }],
                                  [{ script: "sub" }, { script: "super" }],
                                  [
                                    { list: "ordered" },
                                    { list: "bullet" },
                                    { indent: "-1" },
                                    { indent: "+1" },
                                  ],
                                  [{ align: [] }, { direction: "rtl" }],
                                  [
                                    "link",
                                    "image",
                                    "video",
                                    "formula",
                                    "blockquote",
                                  ],
                                  ["clean"],
                                ],
                              }}
                            />

                            {/* Realtime Stats Display */}
                            <div className="absolute bottom-3 left-4 select-none bg-slate-50 dark:bg-slate-800 border dark:border-white/5 rounded px-2 py-1 text-[10px] text-slate-400 dark:text-slate-300 font-bold flex items-center gap-2 shadow-sm pointer-events-none">
                              <span>
                                کلمات:{" "}
                                <b className="text-slate-700 dark:text-white font-mono">
                                  {wCount}
                                </b>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">
                                |
                              </span>
                              <span>
                                کاراکترها:{" "}
                                <b className="text-slate-700 dark:text-white font-mono">
                                  {cCount}
                                </b>
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Sleek Bottom Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t dark:border-slate-800 pt-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                    >
                      ذخیره متون فعلی به عنوان قالب
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedOptionsModal(true)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <Sliders size={13} />
                      تنظیمات کاغذ و امضاها ({newLetterForm.signers?.length || 0} امضاکننده)
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewLetterModal(false)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle size={15} />
                      ثبت نهایی و صدور شماره نامه
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1.1 ADVANCED SETTINGS & SIGNERS MODAL */}
      <AnimatePresence>
        {showAdvancedOptionsModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                <h4 className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <Sliders size={16} className="text-purple-600" />
                  تنظیمات ساختاری کاغذ، امضاکنندگان و ضمائم نامه
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptionsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Page & Stamp Config */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">اندازه کاغذ</label>
                  <select
                    value={newLetterForm.paperSize}
                    onChange={(e) =>
                      setNewLetterForm({
                        ...newLetterForm,
                        paperSize: e.target.value as "A4" | "A5",
                      })
                    }
                    className="w-full border dark:border-slate-700 dark:bg-slate-800 rounded-lg p-2 text-xs font-bold"
                  >
                    <option value="A4">A4 (استاندارد)</option>
                    <option value="A5">A5 (کوچک)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">جهت کاغذ</label>
                  <select
                    value={newLetterForm.orientation}
                    onChange={(e) =>
                      setNewLetterForm({
                        ...newLetterForm,
                        orientation: e.target.value as "portrait" | "landscape",
                      })
                    }
                    className="w-full border dark:border-slate-700 dark:bg-slate-800 rounded-lg p-2 text-xs font-bold"
                  >
                    <option value="portrait">عمودی (Portrait)</option>
                    <option value="landscape">افقی (Landscape)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">مکان امضا و مهر</label>
                  <select
                    value={newLetterForm.signaturePosition}
                    onChange={(e) =>
                      setNewLetterForm({
                        ...newLetterForm,
                        signaturePosition: e.target.value as any,
                      })
                    }
                    className="w-full border dark:border-slate-700 dark:bg-slate-800 rounded-lg p-2 text-xs font-bold"
                  >
                    <option value="bottom_left">پایین سمت چپ</option>
                    <option value="bottom_center">پایین وسط</option>
                    <option value="bottom_right">پایین سمت راست</option>
                  </select>
                </div>
              </div>

              {/* Sign-off text and Signers */}
              <div className="space-y-3 border-t dark:border-slate-800 pt-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    متن پایانی نامه (عبارت احترام‌آمیز)
                  </label>
                  <textarea
                    rows={2}
                    value={newLetterForm.signOffText}
                    onChange={(e) =>
                      setNewLetterForm({
                        ...newLetterForm,
                        signOffText: e.target.value,
                      })
                    }
                    placeholder="مثال: با تشکر و تقدیم احترام"
                    className="w-full border dark:border-slate-700 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                      امضاکنندگان نامه
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const s = newLetterForm.signers || [];
                        setNewLetterForm({
                          ...newLetterForm,
                          signers: [...s, { name: "", title: "" }],
                        });
                      }}
                      className="text-[11px] text-purple-600 font-bold hover:underline"
                    >
                      + افزودن امضاکننده جدید
                    </button>
                  </div>
                  {(!newLetterForm.signers ||
                    newLetterForm.signers.length === 0) && (
                    <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border dark:border-slate-800">
                      بدون امضاکننده متنی (فقط امضای دیجیتال درج می‌شود)
                    </div>
                  )}
                  {newLetterForm.signers?.map((signer, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="نام امضاکننده (مثال: محمد احمدی)"
                        value={signer.name}
                        onChange={(e) => {
                          const newSigners = [
                            ...(newLetterForm.signers || []),
                          ];
                          newSigners[idx].name = e.target.value;
                          setNewLetterForm({
                            ...newLetterForm,
                            signers: newSigners,
                          });
                        }}
                        className="flex-1 border dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="سمت (مثال: مدیر عامل)"
                        value={signer.title}
                        onChange={(e) => {
                          const newSigners = [
                            ...(newLetterForm.signers || []),
                          ];
                          newSigners[idx].title = e.target.value;
                          setNewLetterForm({
                            ...newLetterForm,
                            signers: newSigners,
                          });
                        }}
                        className="flex-1 border dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSigners = [
                            ...(newLetterForm.signers || []),
                          ];
                          newSigners.splice(idx, 1);
                          setNewLetterForm({
                            ...newLetterForm,
                            signers: newSigners,
                          });
                        }}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 border-t dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    الصاق فایل‌های پیوست (اسناد، تصاویر، PDF)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleAttachmentUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border dark:border-slate-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
                    disabled={uploadingAttachment}
                  >
                    <Upload size={13} />
                    {uploadingAttachment
                      ? "درحال آپلود..."
                      : "انتخاب و الصاق فایل جدید"}
                  </button>
                </div>

                {newLetterForm.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {newLetterForm.attachments.map((file, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                      >
                        <FileText size={12} className="text-purple-600" />
                        <span className="truncate max-w-[150px]">
                          {file.fileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(i)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    هیچ فایلی الصاق نشده است.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptionsModal(false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2 rounded-xl"
                >
                  تایید و بازگشت به نگارش نامه
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. DETAILED LETTER VIEW MODAL */}
      <AnimatePresence>
        {selectedLetterForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl max-w-6xl w-full p-4 sm:p-5 shadow-2xl flex flex-col max-h-[92vh] text-right"
              dir="rtl"
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-800 dark:text-white flex items-center gap-1.5">
                    <FileText size={18} className="text-purple-600" />
                    نامه اداری شماره: {selectedLetterForView.letterNumber}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      selectedLetterForView.type === "internal"
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                        : selectedLetterForView.type === "incoming"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}
                  >
                    {selectedLetterForView.type === "internal"
                      ? "داخلی"
                      : selectedLetterForView.type === "incoming"
                        ? "وارده"
                        : "صادره"}
                  </span>
                  {selectedLetterForView.isPrivate && (
                    <span className="text-[10px] bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Lock size={10} /> محرمانه
                    </span>
                  )}
                  {selectedLetterForView.status === SecretariatLetterStatus.ARCHIVED && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Archive size={10} /> بایگانی‌شده
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {canEditLetters && (
                    <button
                      onClick={() =>
                        handleEditLetterClick(selectedLetterForView)
                      }
                      className="p-1.5 text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                      title="ویرایش نامه"
                    >
                      <Edit size={14} /> <span className="hidden sm:inline">ویرایش</span>
                    </button>
                  )}
                  {canDeleteLetters && (
                    <button
                      onClick={() =>
                        handleDeleteLetter(selectedLetterForView.id)
                      }
                      className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/40 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                      title="حذف نامه"
                    >
                      <Trash2 size={14} /> <span className="hidden sm:inline">حذف</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsPrintMode(selectedLetterForView)}
                    className="p-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                    title="چاپ با بالاترین کیفیت"
                  >
                    <Printer size={14} /> <span className="hidden sm:inline">چاپ و پیش‌نمایش</span>
                  </button>
                  <button
                    onClick={() => handleShareSecretariatLetterToChat(selectedLetterForView)}
                    disabled={isSharingLetter}
                    className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                    title="ارسال مستقیم تصویر نامه اداری به گفتگو"
                  >
                    {isSharingLetter ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                    <span className="hidden sm:inline">ارسال به گفتگو</span>
                  </button>

                  <button
                    onClick={() => setSelectedLetterForView(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Compact Metadata Ribbon (جمع و جور کردن مشخصات و موضوع نامه) */}
              <div className="bg-slate-50 dark:bg-slate-800/80 border dark:border-slate-700/60 rounded-xl p-2.5 my-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-black text-slate-400 dark:text-slate-400 shrink-0">موضوع نامه:</span>
                  <span className="font-black text-slate-800 dark:text-white truncate max-w-sm sm:max-w-md">{selectedLetterForView.subject}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <div><b className="text-slate-400 font-bold">فرستنده:</b> {selectedLetterForView.sender}</div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div><b className="text-slate-400 font-bold">گیرنده:</b> {selectedLetterForView.receiver}</div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div><b className="text-slate-400 font-bold">تاریخ:</b> <span className="font-mono">{selectedLetterForView.date}</span></div>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div><b className="text-slate-400 font-bold">پیوست:</b> {selectedLetterForView.attachments?.length ? `${selectedLetterForView.attachments.length} فایل` : "ندارد"}</div>
                </div>
              </div>

              {/* Main Two Column layout for Full Visibility */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Left/Center: Letter Document Paper (High Priority & Space) */}
                <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950/60 rounded-xl border dark:border-slate-800/80 p-2 sm:p-4">
                  <div className="overflow-y-auto flex-1 flex flex-col items-center custom-scrollbar">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-xl p-6 sm:p-8 w-full max-w-2xl min-h-[460px] flex flex-col justify-between text-right font-sans">
                      <div>
                        {/* Header metadata strip on paper */}
                        <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3 mb-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{selectedCompany.name}</span>
                          <div className="text-left space-y-0.5">
                            <div>تاریخ: {selectedLetterForView.date}</div>
                            <div>شماره: {selectedLetterForView.letterNumber}</div>
                            <div>پیوست: {selectedLetterForView.attachments?.length > 0 ? "دارد" : "ندارد"}</div>
                          </div>
                        </div>

                        {/* Receiver & Subject line on paper */}
                        <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 mb-4">
                          <div><b className="text-slate-900 dark:text-white">به:</b> {selectedLetterForView.receiver}</div>
                          <div><b className="text-slate-900 dark:text-white">از:</b> {selectedLetterForView.sender}</div>
                          <div className="pt-1.5 border-t border-dashed dark:border-slate-800"><b className="text-slate-900 dark:text-white">موضوع:</b> {selectedLetterForView.subject}</div>
                        </div>

                        {/* Full Letter Content */}
                        <div
                          className="ql-editor py-2 text-slate-800 dark:text-slate-100 leading-loose whitespace-pre-wrap font-medium text-xs sm:text-sm"
                          dangerouslySetInnerHTML={{
                            __html: selectedLetterForView.content,
                          }}
                        />
                      </div>

                      {/* Sign-off text and Signatures */}
                      <div className="pt-6 border-t border-dashed dark:border-slate-800 mt-6 space-y-3">
                        {selectedLetterForView.signOffText && (
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {selectedLetterForView.signOffText}
                          </div>
                        )}

                        <div className="flex flex-wrap items-end justify-between gap-4">
                          {/* Company Stamp if enabled */}
                          {selectedLetterForView.addCompanyStamp && companySettingsForm.companyStampUrl && (
                            <div className="flex flex-col items-center">
                              <img
                                src={companySettingsForm.companyStampUrl}
                                alt="مهر شرکت"
                                className="h-16 w-auto object-contain mix-blend-multiply dark:mix-blend-normal opacity-90"
                              />
                              <span className="text-[9px] text-red-600 font-bold mt-1">مهر رسمی شرکت</span>
                            </div>
                          )}

                          {/* Signatures */}
                          <div className="flex flex-wrap gap-3 justify-end ml-auto">
                            {selectedLetterForView.approvedBy && selectedLetterForView.approvedBy.length > 0 ? (
                              selectedLetterForView.approvedBy.map((userId, i) => {
                                const signer = users.find((u) => u.id === userId);
                                const sigUrl = selectedLetterForView.signatureImageUrls?.[i];
                                return (
                                  <div
                                    key={i}
                                    className="text-center space-y-1 bg-slate-50 dark:bg-slate-800/80 p-2 border dark:border-slate-700 rounded-lg min-w-[110px]"
                                  >
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block flex items-center gap-0.5 justify-center">
                                      <CheckCircle size={11} /> تایید و امضا شد
                                    </span>
                                    {sigUrl ? (
                                      <img
                                        src={sigUrl}
                                        className="h-10 mx-auto object-contain mix-blend-multiply dark:mix-blend-normal"
                                      />
                                    ) : (
                                      <div className="h-10 flex items-center justify-center text-[10px] text-slate-400">
                                        امضای دیجیتال
                                      </div>
                                    )}
                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 block">
                                      {signer?.fullName || "کاربر سیستم"}
                                    </span>
                                  </div>
                                );
                              })
                            ) : selectedLetterForView.signers && selectedLetterForView.signers.length > 0 ? (
                              selectedLetterForView.signers.map((s, i) => (
                                <div key={i} className="text-center space-y-0.5 min-w-[100px] border-t pt-1">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-white">{s.name}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.title}</div>
                                </div>
                              ))
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Letter attachments view link */}
                    {selectedLetterForView.attachments?.length > 0 && (
                      <div className="w-full max-w-2xl mt-3 space-y-1.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl p-3">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block flex items-center gap-1">
                          <FileText size={13} className="text-purple-600" />
                          فایل‌های الصاقی (پیوست‌ها):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedLetterForView.attachments.map((file, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="referrer"
                                className="flex-1 flex items-center justify-between bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-purple-700 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-bold truncate"
                              >
                                <span className="flex items-center gap-1 truncate">
                                  <FileText size={13} className="shrink-0" /> <span className="truncate">{file.fileName}</span>
                                </span>
                                <span className="text-[9px] text-slate-400 shrink-0 ml-1">
                                  دانلود
                                </span>
                              </a>
                              <button
                                type="button"
                                onClick={() => openSendToChat({
                                  fileUrl: file.url,
                                  fileName: file.fileName,
                                  title: `ارسال پیوست ${file.fileName} به گفتگو`,
                                  defaultMessage: `📎 فایل پیوست نامه شماره ${selectedLetterForView.letterNumber || '-'}: ${file.fileName}`
                                })}
                                className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800/40 transition-colors cursor-pointer shrink-0"
                                title="ارسال مستقیم پیوست به گفتگو"
                              >
                                <MessageSquare size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Side Actions, Referrals & Comments */}
                <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
                  {/* Approval Actions Panel */}
                  <div className="p-3.5 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-2.5 shadow-xs">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 border-b dark:border-slate-800 pb-2">
                      <UserCheck size={14} className="text-purple-600" />
                      اقدامات و تایید نامه اداری
                    </span>

                    <div className="flex flex-col gap-2">
                      {/* Sign and Confirm Button */}
                      <button
                        onClick={handleApproveSign}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm hover:shadow transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus size={15} /> تایید و امضای رسمی نامه (الصاق تصویر امضا)
                      </button>

                      {/* Reject Letter */}
                      <button
                        onClick={handleRejectLetter}
                        className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-xs py-1.5 px-3 rounded-lg border border-red-200 dark:border-red-800/40 transition-colors flex items-center justify-center gap-1"
                      >
                        مخالفت و رد نامه اداری
                      </button>

                      {/* Company Stamp toggle */}
                      {companySettingsForm.companyStampUrl && (
                        <label className="flex items-center gap-2 bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedLetterForView.addCompanyStamp || false}
                            onChange={async (e) => {
                              const updated: SecretariatLetter = {
                                ...selectedLetterForView,
                                addCompanyStamp: e.target.checked,
                                updatedAt: Date.now(),
                              };
                              try {
                                const letters = await updateSecretariatLetter(updated);
                                setLetters(letters);
                                setSelectedLetterForView(updated);
                              } catch (err) {
                                alert("خطا در تغییر وضعیت مهر شرکت");
                              }
                            }}
                            className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            <Award size={13} className="text-red-600" /> درج مهر رسمی شرکت پای این نامه
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Quick status controls (Archive/Unarchive/Delete) */}
                    <div className="flex gap-2 border-t dark:border-slate-800 pt-2.5">
                      <button
                        onClick={() => handleToggleArchive(selectedLetterForView)}
                        className="flex-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Archive size={12} />
                        {selectedLetterForView.status === SecretariatLetterStatus.ARCHIVED
                          ? "خروج از بایگانی"
                          : "انتقال به بایگانی اسناد"}
                      </button>
                    </div>
                  </div>

                  {/* Letter Official Export PDF/DOCX Card */}
                  <div className="p-3.5 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-2 shadow-xs">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 border-b dark:border-slate-800 pb-2">
                      <Download size={14} className="text-blue-600" />
                      خروجی رسمی و دریافت فایل
                    </span>

                    <button
                      type="button"
                      onClick={() => openSendToChat({
                        fileUrl: `/api/secretariat/letters/${selectedLetterForView.id}/pdf`,
                        fileName: `Letter_${selectedLetterForView.letterNumber || selectedLetterForView.id}.pdf`,
                        title: "ارسال فایل PDF رسمی نامه به گفتگو",
                        defaultMessage: `📄 فایل PDF رسمی نامه اداری شماره ${selectedLetterForView.letterNumber || '-'}: ${selectedLetterForView.subject || ''}`
                      })}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg py-1.5 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      <MessageSquare size={13} />
                      ارسال فایل PDF رسمی به گفتگو
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <a
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/pdf`}
                        className="flex items-center justify-center gap-1 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 hover:bg-red-100 rounded-lg py-1.5 text-[10px] font-bold transition-all"
                        download
                      >
                        <FileText size={12} /> PDF با سربرگ
                      </a>
                      <a
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/pdf?noLetterhead=true`}
                        className="flex items-center justify-center gap-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-lg py-1.5 text-[10px] font-bold transition-all"
                        download
                      >
                        <FileText size={12} /> PDF بدون سربرگ
                      </a>
                      <a
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/docx`}
                        className="flex items-center justify-center gap-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg py-1.5 text-[10px] font-bold transition-all"
                        download
                      >
                        <FileText size={12} /> Word با سربرگ
                      </a>
                      <a
                        href={`/api/secretariat/letters/${selectedLetterForView.id}/docx?noLetterhead=true`}
                        className="flex items-center justify-center gap-1 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 rounded-lg py-1.5 text-[10px] font-bold transition-all"
                        download
                      >
                        <FileText size={12} /> Word بدون سربرگ
                      </a>
                    </div>
                  </div>

                  {/* Referral Panel */}
                  <div className="p-3.5 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-2 shadow-xs">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 border-b dark:border-slate-800 pb-2">
                      <Share2 size={14} className="text-amber-600" /> ارجاع نامه به پرسنل
                    </span>

                    <div className="max-h-28 overflow-y-auto border dark:border-slate-800 rounded-lg p-1.5 space-y-1 bg-slate-50/50 dark:bg-slate-800/50">
                      {users
                        .filter((u) => u.id !== currentUser.id)
                        .map((u) => {
                          const isReferred =
                            selectedLetterForView.referredTo?.includes(u.id);
                          const isSelected = selectedReferrals.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 text-[11px] hover:bg-white dark:hover:bg-slate-800 p-1 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isReferred || isSelected}
                                disabled={isReferred}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedReferrals((p) =>
                                      p.filter((id) => id !== u.id),
                                    );
                                  } else {
                                    setSelectedReferrals((p) => [...p, u.id]);
                                  }
                                }}
                                className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                              />
                              <span
                                className={`font-bold ${isReferred ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}
                              >
                                {u.fullName} {isReferred && "(ارجاع شده)"}
                              </span>
                            </label>
                          );
                        })}
                    </div>

                    <button
                      onClick={handleReferLetter}
                      disabled={selectedReferrals.length === 0}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ثبت ارجاعات انتخابی
                    </button>
                  </div>

                  {/* Comments Panel */}
                  <div className="p-3.5 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-2 shadow-xs">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 border-b dark:border-slate-800 pb-2">
                      <MessageSquare size={14} className="text-indigo-600" />
                      نظرات و پیگیری پاراف‌ها
                    </span>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {!selectedLetterForView.comments ||
                      selectedLetterForView.comments.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-2">
                          نظری برای این نامه ثبت نشده است.
                        </p>
                      ) : (
                        selectedLetterForView.comments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg text-[10px] space-y-0.5 leading-relaxed border dark:border-slate-700"
                          >
                            <div className="flex justify-between items-center text-slate-400">
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                {c.username}
                              </span>
                              <span>
                                {new Date(c.createdAt).toLocaleDateString(
                                  "fa-IR",
                                )}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 font-medium">
                              {c.comment}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1.5 border-t dark:border-slate-800">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="ثبت نظر یا پاراف اداری..."
                        className="flex-1 border dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs"
                      />
                      <button
                        onClick={handleAddComment}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1 rounded-lg transition-colors"
                      >
                        ارسال
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. HIGH QUALITY PRINT & PDF GENERATOR LAYOUT MODAL */}
      <AnimatePresence>
        {isPrintMode && (
          <div className="fixed inset-0 z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-right"
              dir="rtl"
            >
              {/* UI controls that are hidden on print */}
              <div className="flex items-center justify-between border-b pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Printer size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-gray-800">
                      پیش‌نمایش چاپ فوق‌العاده با کیفیت (فرمت A4)
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      سیستم به صورت خودکار اندازه، فواصل و سربرگ را متناسب با
                      استانداردهای چاپ تراز می‌کند.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Append custom print styles to ensure perfection
                      const style = document.createElement("style");
                      style.id = "secretariat-print-style";

                      const paperWidth =
                        isPrintMode.paperSize === "A5"
                          ? isPrintMode.orientation === "landscape"
                            ? "210mm"
                            : "148mm"
                          : isPrintMode.orientation === "landscape"
                            ? "297mm"
                            : "210mm";
                      const paperHeight =
                        isPrintMode.paperSize === "A5"
                          ? isPrintMode.orientation === "landscape"
                            ? "148mm"
                            : "210mm"
                          : isPrintMode.orientation === "landscape"
                            ? "210mm"
                            : "297mm";

                      style.innerHTML = `
                        @media print {
                          @page { 
                            size: ${isPrintMode.paperSize || "A4"} ${isPrintMode.orientation || "portrait"}; 
                            margin: 0 !important; 
                          }
                          body * {
                            visibility: hidden;
                          }
                          #print-content-section, #print-content-section * {
                            visibility: visible;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                          }
                          #print-content-section {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: ${paperWidth} !important;
                            height: ${paperHeight} !important;
                            background: white !important;
                            color: black !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                            overflow: visible !important;
                          }
                          .print\\:hidden {
                            display: none !important;
                          }
                        }
                      `;
                      document.head.appendChild(style);
                      window.print();
                      // Remove after print starts
                      setTimeout(() => {
                        const s = document.getElementById(
                          "secretariat-print-style",
                        );
                        if (s) s.remove();
                      }, 500);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-colors flex items-center gap-1.5"
                  >
                    <Printer size={16} /> چاپ و ذخیره به عنوان PDF
                  </button>

                  <button
                    onClick={() => handleShareSecretariatLetterToChat(isPrintMode)}
                    disabled={isSharingLetter}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="ارسال مستقیم تصویر و برگه نامه به گفتگوی سازمانی"
                  >
                    {isSharingLetter ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    ارسال به گفتگو
                  </button>

                  <button
                    onClick={() => setIsPrintMode(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    بستن پیش‌نمایش
                  </button>
                </div>
              </div>

              {/* PRINTABLE AREA */}
              <div
                id="print-content-section"
                className={`bg-white border rounded-xl mx-auto shadow-xs relative text-black
                  ${
                    isPrintMode.paperSize === "A5"
                      ? isPrintMode.orientation === "landscape"
                        ? "max-w-[21cm] min-h-[14.8cm]"
                        : "max-w-[14.8cm] min-h-[21cm]"
                      : isPrintMode.orientation === "landscape"
                        ? "max-w-[29.7cm] min-h-[21cm]"
                        : "max-w-[21cm] min-h-[29.7cm]"
                  }
                `}
                style={{
                  fontFamily:
                    companySettingsForm.letterheadFontFamily || "sans-serif",
                  overflow: "hidden", // clip background
                }}
              >
                {/* Absolutely positioned metadata block if custom coordinates are defined, or custom letterhead is active */}
                {(companySettingsForm.letterheadUrl ||
                  companySettingsForm.metadataTop !== undefined ||
                  companySettingsForm.metadataLeft !== undefined) && (
                  <div
                    style={{
                      position: "absolute",
                      top: `${companySettingsForm.metadataTop ?? 25}mm`,
                      left: `${companySettingsForm.metadataLeft ?? 20}mm`,
                      fontSize: `${companySettingsForm.metadataFontSize ?? 11}px`,
                      color: companySettingsForm.metadataColor || "#0f172a",
                      lineHeight: "1.8",
                      fontWeight: companySettingsForm.metadataFontWeight || "bold",
                      textAlign: "right",
                      direction: "rtl",
                      zIndex: 50,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div>
                      شماره:{" "}
                      <span
                        style={{ direction: "ltr", display: "inline-block" }}
                      >
                        {toPersianDigits(isPrintMode.letterNumber)}
                      </span>
                    </div>
                    <div>
                      تاریخ:{" "}
                      <span
                        style={{ direction: "ltr", display: "inline-block" }}
                      >
                        {toPersianDigits(isPrintMode.date)}
                      </span>
                    </div>
                    <div>
                      پیوست:{" "}
                      {isPrintMode.attachments?.length > 0 ? "دارد" : "ندارد"}
                    </div>
                  </div>
                )}

                {/* Custom Image Letterhead Background or Corporate Mockup Header */}
                {companySettingsForm.letterheadUrl ? (
                  <img
                    src={companySettingsForm.letterheadUrl}
                    className="absolute inset-0 w-full h-full opacity-100 z-0 pointer-events-none"
                    style={{ objectFit: "fill" }}
                  />
                ) : (
                  /* Elegant default corporate letterhead */
                  <div className="border-b-2 border-double border-slate-800 pb-4 mb-8 flex justify-between items-center relative z-10 px-8 pt-8">
                    {/* Left: Metadata (Only shown here if NOT absolutely positioned) */}
                    {companySettingsForm.metadataTop === undefined &&
                    companySettingsForm.metadataLeft === undefined ? (
                      <div className="text-[11px] font-bold space-y-1.5 text-slate-800 w-1/3 text-right">
                        <div>
                          تاریخ:{" "}
                          <span
                            style={{
                              direction: "ltr",
                              display: "inline-block",
                            }}
                          >
                            {toPersianDigits(isPrintMode.date)}
                          </span>
                        </div>
                        <div>
                          شماره نامه:{" "}
                          <span
                            style={{
                              direction: "ltr",
                              display: "inline-block",
                            }}
                          >
                            {toPersianDigits(isPrintMode.letterNumber)}
                          </span>
                        </div>
                        <div>
                          پیوست:{" "}
                          {isPrintMode.attachments?.length > 0
                            ? "دارد"
                            : "ندارد"}
                        </div>
                      </div>
                    ) : (
                      <div className="w-1/3"></div> /* Empty spacer to preserve layout symmetry */
                    )}

                    {/* Center: Title & Islamic Republic logo element */}
                    <div className="text-center space-y-1.5 flex-1">
                      <span className="text-[10px] text-slate-400 block font-bold">
                        باسمه تعالی
                      </span>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">
                        {selectedCompany.name}
                      </h2>
                      <span className="text-[10px] text-slate-500 font-bold block bg-slate-100 px-3 py-0.5 rounded-full w-fit mx-auto">
                        دبیرخانه مرکزی (
                        {activeSection === "headquarters"
                          ? "دفتر مرکزی"
                          : "کارخانه"}
                        )
                      </span>
                    </div>

                    {/* Right: Company Logo Place */}
                    <div className="w-1/3 flex justify-end">
                      <div className="w-16 h-16 border-2 border-double rounded-xl overflow-hidden flex items-center justify-center p-1 bg-slate-50">
                        {selectedCompany.logo ? (
                          <img
                            src={selectedCompany.logo}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-lg font-black text-slate-700">
                            {selectedCompany.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Letter Body Context */}
                <div
                  className="space-y-4 text-sm leading-loose text-slate-800 relative z-10"
                  style={{
                    paddingTop: companySettingsForm.letterheadUrl
                      ? `${companySettingsForm.marginTop ?? 40}mm`
                      : "12px",
                    paddingBottom: `${companySettingsForm.marginBottom ?? 25}mm`,
                    paddingRight: `${companySettingsForm.marginRight ?? 20}mm`,
                    paddingLeft: `${companySettingsForm.marginLeft ?? 20}mm`,
                    minHeight: isPrintMode.paperSize === "A5" ? "250px" : "450px",
                  }}
                >
                  {/* Salutations */}
                  {(!isPrintMode.hideSubjectInLetter ||
                    !isPrintMode.hideSalutationInLetter) && (
                    <div className="font-bold space-y-2 mb-4">
                      {!isPrintMode.hideSubjectInLetter && (
                        <div className="text-base font-medium">
                          موضوع: {isPrintMode.subject}
                        </div>
                      )}
                      {!isPrintMode.hideSalutationInLetter && (
                        <div className="text-base font-medium">
                          با سلام و احترام،
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Content from Quill */}
                  <div
                    className="ql-editor pt-2 text-justify whitespace-pre-wrap leading-loose font-medium text-slate-800 text-[14px]"
                    dangerouslySetInnerHTML={{ __html: isPrintMode.content }}
                  ></div>

                  {/* Signatures & Stamp block */}
                  <div
                    className={`mt-16 w-64 text-center space-y-2 ${
                      isPrintMode.signaturePosition === "bottom_left"
                        ? "mr-auto ml-0"
                        : isPrintMode.signaturePosition === "bottom_center"
                          ? "mx-auto"
                          : "ml-auto mr-0"
                    }`}
                  >
                    <div className="font-bold text-sm mb-4 whitespace-pre-wrap leading-relaxed">
                      {isPrintMode.signOffText || "با تشکر"}
                    </div>

                    {isPrintMode.signers && isPrintMode.signers.length > 0 && (
                      <div className="flex gap-4 justify-center flex-wrap mt-2">
                        {isPrintMode.signers.map((signer, idx) => (
                          <div key={idx} className="flex flex-col items-center">
                            <div className="font-bold text-sm">
                              {signer.name}
                            </div>
                            <div className="text-xs text-gray-600 font-bold">
                              {signer.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative mt-2 flex justify-center items-center">
                      {isPrintMode.approvedBy &&
                        isPrintMode.approvedBy.length > 0 && (
                          <div className="flex justify-center gap-2 relative z-10 w-full flex-wrap">
                            {isPrintMode.approvedBy.map((userId, idx) => {
                              const sigUrl =
                                isPrintMode.signatureImageUrls?.[idx];
                              return sigUrl ? (
                                <img
                                  key={idx}
                                  src={sigUrl}
                                  className="h-16 object-contain mix-blend-multiply"
                                />
                              ) : null;
                            })}
                          </div>
                        )}
                      {isPrintMode.addCompanyStamp &&
                        companySettingsForm.companyStampUrl && (
                          <img
                            src={companySettingsForm.companyStampUrl}
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply z-0"
                            style={{
                              height: companySettingsForm.companyStampSize
                                ? `${companySettingsForm.companyStampSize}px`
                                : "120px",
                              width: companySettingsForm.companyStampSize
                                ? `${companySettingsForm.companyStampSize}px`
                                : "120px",
                              opacity: companySettingsForm.companyStampOpacity
                                ? companySettingsForm.companyStampOpacity / 100
                                : 0.7,
                            }}
                          />
                        )}
                    </div>
                  </div>
                </div>

                {/* Footer bar containing metadata of address/phone */}
                {(!companySettingsForm.hideAutoFooter ||
                  !companySettingsForm.letterheadUrl) && (
                  <div className="absolute bottom-6 left-8 right-8 text-[10px] text-slate-400 border-t pt-2 flex justify-between items-center flex-wrap gap-2 print:border-t">
                    <span>نشانی: {selectedCompany.address || "ثبت نشده"}</span>
                    <div className="flex gap-4">
                      <span>تلفن: {selectedCompany.phone || "ثبت نشده"}</span>
                      <span>کدپستی: {selectedCompany.postalCode || "-"}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SecretariatModule;
