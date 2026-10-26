import { FiSearch, FiX } from "react-icons/fi";

function SearchBar({ search = "", setSearch, onSearch, onChange }) {
  const handleChange = (event) => {
    const value = event.target.value;
    if (typeof setSearch === "function") setSearch(value);
    if (typeof onSearch === "function") onSearch(value);
    if (typeof onChange === "function") onChange(event);
  };

  const handleClear = () => {
    if (typeof setSearch === "function") setSearch("");
    if (typeof onSearch === "function") onSearch("");
  };

  return (
    <div className="search-container">
      <div className="search-icon-wrapper" aria-hidden="true">
        <FiSearch className="search-icon" />
      </div>

      <input
        id="task-search-input"
        className="search-input"
        type="text"
        placeholder="Filter tasks by title or keyword..."
        value={search}
        onChange={handleChange}
        autoComplete="off"
        aria-label="Search tasks"
      />

      {search ? (
        <button
          type="button"
          className="search-clear"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
        >
          <FiX />
        </button>
      ) : (
        <kbd className="search-shortcut" title="Press / to focus">
          /
        </kbd>
      )}
    </div>
  );
}

export default SearchBar;
