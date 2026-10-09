import { FaSearch, FaTimes } from "react-icons/fa";

function SearchBar({ search, setSearch }) {
  return (
    <div className="search-container">
      <FaSearch className="search-icon" aria-hidden="true" />

      <input
        className="search-input"
        type="text"
        placeholder="Search your task..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        aria-label="Search tasks"
      />

      {search && (
        <button
          className="search-clear"
          onClick={() => setSearch("")}
          aria-label="Clear search"
        >
          <FaTimes />
        </button>
      )}
    </div>
  );
}

export default SearchBar;