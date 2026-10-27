import { useState, useRef, useEffect } from "react";
import {
  FiUser,
  FiMail,
  FiLock,
  FiKey,
  FiEye,
  FiEyeOff,
  FiCamera,
  FiTrash2,
  FiCheck,
  FiShield,
  FiSliders,
  FiUploadCloud,
  FiSun,
  FiMoon,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiZap,
  FiLayers,
  FiArrowLeft,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { API_URL } from "../apiConfig";

// Curated Gen-Z Gradient Avatar Presets
const AVATAR_PRESETS = [
  {
    id: "cyber-violet",
    name: "Cyber Violet",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)",
    icon: "⚡",
  },
  {
    id: "neon-emerald",
    name: "Neon Emerald",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)",
    icon: "🌱",
  },
  {
    id: "sunset-blaze",
    name: "Sunset Blaze",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)",
    icon: "🔥",
  },
  {
    id: "cosmic-nebula",
    name: "Cosmic Nebula",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)",
    icon: "✨",
  },
  {
    id: "electric-cyan",
    name: "Electric Cyan",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0284c7 50%, #3b82f6 100%)",
    icon: "💎",
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)",
    icon: "🌸",
  },
  {
    id: "golden-aura",
    name: "Golden Aura",
    gradient: "linear-gradient(135deg, #eab308 0%, #f59e0b 50%, #f97316 100%)",
    icon: "👑",
  },
  {
    id: "midnight-dark",
    name: "Midnight Pro",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    icon: "🛸",
  },
];

function generatePresetSvgDataUrl(gradient, icon, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradient.split(",")[1].trim().split(" ")[0]}" />
        <stop offset="100%" stop-color="${gradient.split(",")[3]?.trim()?.split(" ")[0] || "#ec4899"}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g)" />
    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
    <text x="60" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">${icon || label.charAt(0)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function UserProfileSettings({
  user,
  onUpdateUser,
  tasks = [],
  darkMode,
  setDarkMode,
  onClearTasks,
  onLogout,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState("general"); // general | security | preferences
  const fileInputRef = useRef(null);

  // Form State: Profile Information
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form State: Password Update
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Photo Upload State
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatar(user.avatar || null);
    }
  }, [user]);

  // Auth headers
  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // Calculate Password Strength
  const calculateStrength = (pass) => {
    if (!pass) return { score: 0, label: "Empty", color: "#64748b" };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: "Weak", color: "#ef4444" };
    if (score === 2) return { score: 2, label: "Fair", color: "#f97316" };
    if (score === 3 || score === 4) return { score: 3, label: "Good", color: "#eab308" };
    return { score: 4, label: "Strong & Secure", color: "#10b981" };
  };

  const passStrength = calculateStrength(newPassword);

  // Handle Photo Upload with Client-Side Canvas Compression (Scales to 256x256 WebP/JPEG)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, or WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.warning("File is larger than 8MB. Please choose a smaller image.");
      return;
    }

    setIsProcessingPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const targetSize = 256;
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext("2d");

          // Calculate aspect-ratio cropping (center square crop)
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

          // Export compressed WebP or JPEG
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          setAvatar(dataUrl);
          toast.success("Profile photo ready! Click 'Save Changes' to update.");
        } catch (err) {
          console.error("Canvas crop error:", err);
          setAvatar(event.target.result);
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      img.onerror = () => {
        toast.error("Unable to process image.");
        setIsProcessingPhoto(false);
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
      setIsProcessingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  // Select Preset Avatar
  const handleSelectPreset = (preset) => {
    const presetDataUrl = generatePresetSvgDataUrl(
      preset.gradient,
      preset.icon,
      name || "U"
    );
    setAvatar(presetDataUrl);
    toast.info(`✨ Selected ${preset.name} avatar.`);
  };

  // Remove Photo Action
  const handleRemoveAvatar = async () => {
    setAvatar(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Avatar reset to standard initials.");
  };

  // Submit Profile Information (Name, Email, Avatar)
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      toast.warning("Please enter your name.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.warning("Please enter a valid email address.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          avatar: avatar || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update profile.");
      }

      // Update storage and parent state
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        if (onUpdateUser) {
          onUpdateUser(data.user, data.token);
        }
      }

      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Save profile error:", err);
      toast.error(err.message || "Unable to update profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Password Change
  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();

    if (!currentPassword) {
      toast.warning("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      toast.warning("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.warning("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      toast.warning("New password cannot be the same as your current password.");
      return;
    }

    setUpdatingPassword(true);

    try {
      const response = await fetch(`${API_URL}/user/password`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update password.");
      }

      toast.success("Password updated successfully! Your account is secured.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Update password error:", err);
      toast.error(err.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Productivity Metrics Summary for Profile Deck
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => Number(t.completed) === 1).length;
  const activeTasksCount = totalTasksCount - completedTasksCount;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Format Join Date
  const memberSinceFormatted = (() => {
    try {
      if (user?.createdAt) {
        const d = new Date(user.createdAt);
        return d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
        });
      }
    } catch {
      // ignore
    }
    return "October 2026";
  })();

  return (
    <div className="tf-profile-view-wrapper">
      {/* =========================================================================
          1. ULTRA-MODERN GEN-Z HERO BANNER & AVATAR SHOWCASE
          ========================================================================= */}
      <section className="tf-profile-hero-card">
        {/* Dynamic Iridescent Ambient Mesh Glow Backdrop */}
        <div className="tf-profile-ambient-glow" aria-hidden="true" />

        <div className="tf-profile-hero-content">
          {/* Avatar Ring Container */}
          <div className="tf-profile-avatar-block">
            <div className="tf-avatar-ring-outer">
              <div className="tf-avatar-ring-inner">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || "User Avatar"}
                    className="tf-profile-avatar-img"
                  />
                ) : (
                  <div className="tf-profile-avatar-placeholder">
                    {(name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Hover Camera Icon Trigger */}
              <button
                type="button"
                className="tf-avatar-upload-badge-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload custom photo"
                aria-label="Upload profile photo"
              >
                <FiCamera />
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoSelect}
            />
          </div>

          {/* User Headline & Identity Badges */}
          <div className="tf-profile-identity-info">
            <div className="tf-profile-badge-row">
              <span className="tf-pill-badge premium">
                <FiZap className="tf-pill-icon" /> TaskFlow Member
              </span>
              <span className="tf-pill-badge verified">
                <FiCheckCircle className="tf-pill-icon" /> Verified Identity
              </span>
              <span className="tf-pill-badge member-since">
                Member since {memberSinceFormatted}
              </span>
            </div>

            <h1 className="tf-profile-display-name">{name || "TaskFlow User"}</h1>
            <p className="tf-profile-email-subtext">{email || "user@taskflow.dev"}</p>

            {/* Avatar Quick Action Buttons */}
            <div className="tf-avatar-controls-strip">
              <button
                type="button"
                className="tf-btn-avatar-action upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
              >
                {isProcessingPhoto ? (
                  <>
                    <FiRefreshCw className="spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FiUploadCloud />
                    <span>Upload Photo</span>
                  </>
                )}
              </button>

              {avatar && (
                <button
                  type="button"
                  className="tf-btn-avatar-action remove"
                  onClick={handleRemoveAvatar}
                  title="Remove custom photo and reset to initials"
                >
                  <FiTrash2 />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 8 Curated Gen-Z Gradient Avatar Presets Strip */}
        <div className="tf-avatar-presets-palette">
          <div className="tf-presets-label">
            <span>✦ Pick a Gen-Z Avatar Style:</span>
          </div>
          <div className="tf-presets-grid">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="tf-preset-item-btn"
                style={{ background: preset.gradient }}
                onClick={() => handleSelectPreset(preset)}
                title={`Apply ${preset.name} avatar`}
              >
                <span className="tf-preset-icon">{preset.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. LINEAR / APPLE SEGMENTED VIEW SWITCHER
          ========================================================================= */}
      <div className="tf-profile-tabs-header">
        <button
          type="button"
          className={`tf-profile-tab-btn ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          <FiUser />
          <span>General & Profile</span>
        </button>

        <button
          type="button"
          className={`tf-profile-tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <FiShield />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          className={`tf-profile-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
          onClick={() => setActiveTab("preferences")}
        >
          <FiSliders />
          <span>Preferences & Stats</span>
        </button>
      </div>

      {/* =========================================================================
          3. TAB 1: GENERAL & PROFILE INFORMATION
          ========================================================================= */}
      {activeTab === "general" && (
        <div className="tf-tab-pane">
          <form onSubmit={handleSaveProfile} className="tf-profile-form-grid">
            <div className="tf-settings-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill">
                  <FiUser />
                </div>
                <div>
                  <h3 className="tf-card-title">Personal Information</h3>
                  <p className="tf-card-subtitle">
                    Update your public display name, workspace handle, and contact email.
                  </p>
                </div>
              </div>

              <div className="tf-form-field-group">
                <label className="tf-form-label" htmlFor="profile-name-input">
                  Full Name
                </label>
                <div className="tf-input-icon-wrap">
                  <FiUser className="tf-field-icon" />
                  <input
                    id="profile-name-input"
                    type="text"
                    className="tf-settings-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    maxLength={100}
                    disabled={savingProfile}
                  />
                  <span className="tf-input-char-count">{name.length}/100</span>
                </div>
              </div>

              <div className="tf-form-field-group">
                <label className="tf-form-label" htmlFor="profile-email-input">
                  Email Address
                </label>
                <div className="tf-input-icon-wrap">
                  <FiMail className="tf-field-icon" />
                  <input
                    id="profile-email-input"
                    type="email"
                    className="tf-settings-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={savingProfile}
                  />
                  <span className="tf-field-status-badge">
                    <FiCheck /> Verified
                  </span>
                </div>
                <span className="tf-form-field-hint">
                  Your email is used to sign in and securely authenticate your workspace.
                </span>
              </div>

              <div className="tf-card-actions">
                <button
                  type="submit"
                  className="tf-btn-save-primary"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <>
                      <FiRefreshCw className="spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Overview Sidebar Card */}
            <div className="tf-settings-card tf-account-meta-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill violet">
                  <FiZap />
                </div>
                <div>
                  <h3 className="tf-card-title">Workspace Account</h3>
                  <p className="tf-card-subtitle">Account status and subscription details.</p>
                </div>
              </div>

              <div className="tf-meta-details-list">
                <div className="tf-meta-row">
                  <span className="tf-meta-label">Plan Tier:</span>
                  <span className="tf-meta-value highlight">TaskFlow Pro (Personal)</span>
                </div>
                <div className="tf-meta-row">
                  <span className="tf-meta-label">Workspace Status:</span>
                  <span className="tf-meta-value status-active">● Active & Synced</span>
                </div>
                <div className="tf-meta-row">
                  <span className="tf-meta-label">Account ID:</span>
                  <span className="tf-meta-value font-mono">TF-USR-{user?.id || 1}</span>
                </div>
                <div className="tf-meta-row">
                  <span className="tf-meta-label">Joined On:</span>
                  <span className="tf-meta-value">{memberSinceFormatted}</span>
                </div>
              </div>

              <div className="tf-card-notice-box">
                <FiCheckCircle className="tf-notice-icon" />
                <span>
                  All your tasks, daily plans, and Gemini AI models are automatically encrypted and isolated to your account.
                </span>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          4. TAB 2: SECURITY & PASSWORD CHANGE
          ========================================================================= */}
      {activeTab === "security" && (
        <div className="tf-tab-pane">
          <form onSubmit={handleUpdatePassword} className="tf-profile-form-grid">
            <div className="tf-settings-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill emerald">
                  <FiLock />
                </div>
                <div>
                  <h3 className="tf-card-title">Change Password</h3>
                  <p className="tf-card-subtitle">
                    Ensure your account is using a strong password with at least 8 characters.
                  </p>
                </div>
              </div>

              {/* Current Password Field */}
              <div className="tf-form-field-group">
                <label className="tf-form-label" htmlFor="current-pass-input">
                  Current Password
                </label>
                <div className="tf-input-icon-wrap">
                  <FiKey className="tf-field-icon" />
                  <input
                    id="current-pass-input"
                    type={showCurrentPass ? "text" : "password"}
                    className="tf-settings-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={updatingPassword}
                  />
                  <button
                    type="button"
                    className="tf-btn-eye-toggle"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showCurrentPass ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="tf-form-field-group">
                <label className="tf-form-label" htmlFor="new-pass-input">
                  New Password
                </label>
                <div className="tf-input-icon-wrap">
                  <FiLock className="tf-field-icon" />
                  <input
                    id="new-pass-input"
                    type={showNewPass ? "text" : "password"}
                    className="tf-settings-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create a strong new password"
                    disabled={updatingPassword}
                  />
                  <button
                    type="button"
                    className="tf-btn-eye-toggle"
                    onClick={() => setShowNewPass(!showNewPass)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showNewPass ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>

                {/* Interactive Gen-Z Password Strength Meter */}
                {newPassword && (
                  <div className="tf-strength-meter-wrap">
                    <div className="tf-strength-bar-track">
                      <div
                        className={`tf-strength-bar-fill score-${passStrength.score}`}
                        style={{
                          width: `${(passStrength.score / 4) * 100}%`,
                          backgroundColor: passStrength.color,
                        }}
                      />
                    </div>
                    <div className="tf-strength-label-row">
                      <span className="tf-strength-text">
                        Strength:{" "}
                        <strong style={{ color: passStrength.color }}>
                          {passStrength.label}
                        </strong>
                      </span>
                      <span className="tf-strength-hint">Min 8 characters</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password Field */}
              <div className="tf-form-field-group">
                <label className="tf-form-label" htmlFor="confirm-pass-input">
                  Confirm New Password
                </label>
                <div className="tf-input-icon-wrap">
                  <FiShield className="tf-field-icon" />
                  <input
                    id="confirm-pass-input"
                    type={showConfirmPass ? "text" : "password"}
                    className="tf-settings-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    disabled={updatingPassword}
                  />
                  <button
                    type="button"
                    className="tf-btn-eye-toggle"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPass ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {newPassword && confirmPassword && (
                  <span
                    className={`tf-pass-match-indicator ${
                      newPassword === confirmPassword ? "matched" : "mismatch"
                    }`}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <FiCheck /> Passwords match
                      </>
                    ) : (
                      <>
                        <FiAlertTriangle /> Passwords do not match
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="tf-card-actions">
                <button
                  type="submit"
                  className="tf-btn-save-primary"
                  disabled={
                    updatingPassword ||
                    !currentPassword ||
                    newPassword.length < 8 ||
                    newPassword !== confirmPassword
                  }
                >
                  {updatingPassword ? (
                    <>
                      <FiRefreshCw className="spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <FiShield />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Security Checklist Card */}
            <div className="tf-settings-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill cyan">
                  <FiShield />
                </div>
                <div>
                  <h3 className="tf-card-title">Security Recommendations</h3>
                  <p className="tf-card-subtitle">Best practices for maintaining workspace safety.</p>
                </div>
              </div>

              <div className="tf-security-tips-list">
                <div className="tf-security-tip-item">
                  <FiCheck className="tf-tip-check" />
                  <span>Use at least 8 characters combining letters, numbers, and symbols.</span>
                </div>
                <div className="tf-security-tip-item">
                  <FiCheck className="tf-tip-check" />
                  <span>Never reuse passwords from other platforms or email accounts.</span>
                </div>
                <div className="tf-security-tip-item">
                  <FiCheck className="tf-tip-check" />
                  <span>Authentication uses industry-standard salted bcrypt hashing (cost factor 12).</span>
                </div>
                <div className="tf-security-tip-item">
                  <FiCheck className="tf-tip-check" />
                  <span>Your active sessions automatically expire after 7 days for safety.</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          5. TAB 3: PREFERENCES & STATS
          ========================================================================= */}
      {activeTab === "preferences" && (
        <div className="tf-tab-pane">
          <div className="tf-profile-form-grid">
            {/* Theme Preference Card */}
            <div className="tf-settings-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill amber">
                  <FiSun />
                </div>
                <div>
                  <h3 className="tf-card-title">Appearance & Workspace Theme</h3>
                  <p className="tf-card-subtitle">
                    Select your preferred visual style. TaskFlow supports high-contrast dark and clean light modes.
                  </p>
                </div>
              </div>

              <div className="tf-theme-selector-grid">
                {/* Dark Theme Option */}
                <div
                  className={`tf-theme-card-option ${darkMode ? "selected" : ""}`}
                  onClick={() => setDarkMode(true)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="tf-theme-preview-box dark">
                    <div className="tf-preview-topbar" />
                    <div className="tf-preview-body">
                      <div className="tf-preview-line accent" />
                      <div className="tf-preview-line" />
                      <div className="tf-preview-line short" />
                    </div>
                  </div>
                  <div className="tf-theme-option-info">
                    <div className="tf-theme-title-row">
                      <FiMoon className="tf-theme-icon" />
                      <span className="tf-theme-title">Dark Mode</span>
                    </div>
                    <span className="tf-theme-desc">OLED Charcoal & Deep Violet</span>
                  </div>
                  {darkMode && <FiCheckCircle className="tf-theme-checked-icon" />}
                </div>

                {/* Light Theme Option */}
                <div
                  className={`tf-theme-card-option ${!darkMode ? "selected" : ""}`}
                  onClick={() => setDarkMode(false)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="tf-theme-preview-box light">
                    <div className="tf-preview-topbar" />
                    <div className="tf-preview-body">
                      <div className="tf-preview-line accent" />
                      <div className="tf-preview-line" />
                      <div className="tf-preview-line short" />
                    </div>
                  </div>
                  <div className="tf-theme-option-info">
                    <div className="tf-theme-title-row">
                      <FiSun className="tf-theme-icon" />
                      <span className="tf-theme-title">Light Mode</span>
                    </div>
                    <span className="tf-theme-desc">Crisp Snow & Soft Indigo</span>
                  </div>
                  {!darkMode && <FiCheckCircle className="tf-theme-checked-icon" />}
                </div>
              </div>
            </div>

            {/* Productivity Health Summary Card */}
            <div className="tf-settings-card">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill cyan">
                  <FiLayers />
                </div>
                <div>
                  <h3 className="tf-card-title">Productivity Velocity</h3>
                  <p className="tf-card-subtitle">Lifetime execution metrics for this account.</p>
                </div>
              </div>

              <div className="tf-stats-quad-grid">
                <div className="tf-stat-tile">
                  <span className="tf-stat-val">{totalTasksCount}</span>
                  <span className="tf-stat-name">Total Tasks</span>
                </div>
                <div className="tf-stat-tile emerald">
                  <span className="tf-stat-val">{completedTasksCount}</span>
                  <span className="tf-stat-name">Completed</span>
                </div>
                <div className="tf-stat-tile violet">
                  <span className="tf-stat-val">{activeTasksCount}</span>
                  <span className="tf-stat-name">Active Backlog</span>
                </div>
                <div className="tf-stat-tile cyan">
                  <span className="tf-stat-val">{completionRate}%</span>
                  <span className="tf-stat-name">Completion Rate</span>
                </div>
              </div>

              {onNavigate && (
                <div className="tf-card-actions">
                  <button
                    type="button"
                    className="tf-btn-view-intelligence"
                    onClick={() => onNavigate("intelligence")}
                  >
                    <span>View Full Productivity Intelligence</span>
                    <FiArrowLeft style={{ transform: "rotate(180deg)" }} />
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone Card */}
            <div className="tf-settings-card danger-zone">
              <div className="tf-card-header">
                <div className="tf-card-icon-pill red">
                  <FiAlertTriangle />
                </div>
                <div>
                  <h3 className="tf-card-title">Danger Zone</h3>
                  <p className="tf-card-subtitle">Actions that impact your workspace data or session.</p>
                </div>
              </div>

              <div className="tf-danger-actions-list">
                <div className="tf-danger-row">
                  <div>
                    <h4 className="tf-danger-heading">Clear Tasks from Workspace</h4>
                    <p className="tf-danger-desc">
                      Bulk remove completed tasks or completely reset your active tasks backlog.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tf-btn-danger-outline"
                    onClick={onClearTasks}
                  >
                    <FiTrash2 /> Clear Tasks
                  </button>
                </div>

                <div className="tf-danger-row">
                  <div>
                    <h4 className="tf-danger-heading">Sign Out of Session</h4>
                    <p className="tf-danger-desc">
                      Safely terminate your authenticated session on this browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tf-btn-danger-solid"
                    onClick={onLogout}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileSettings;
