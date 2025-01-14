let all_files = [];

let github_repo_url = window.localStorage.getItem("github_url") || null;

const resizer = document.querySelector(".resizer");
const leftPanel = document.querySelector(".left");
const rightPanel = document.querySelector(".right");
const container = document.querySelector(".container");
const filesComponent = document.querySelector(".files");
const form = document.querySelector(".form");
const formInput = document.querySelector("#github-repo-url");
const fileContent = document.getElementById("file-content");

let isResizing = false;

window.addEventListener("load", () => {
  if (github_repo_url) {
    formInput.value = github_repo_url;
    formInput.setAttribute("value", github_repo_url);
    loadGithubFiles(github_repo_url);
  }
});

resizer.addEventListener("mousedown", () => {
  isResizing = true;
  document.body.style.cursor = "ew-resize";
  resizer.classList.add("active");
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;

  const containerRect = container.getBoundingClientRect();
  const newLeftWidth = e.clientX - containerRect.left;
  const minLeftPanelWidth = 50;
  const maxLeftWidth = containerRect.width - minLeftPanelWidth;

  if (newLeftWidth > minLeftPanelWidth && newLeftWidth < maxLeftWidth) {
    const newRightWidth = containerRect.width - newLeftWidth;
    leftPanel.style.width = `${newLeftWidth}px`;
    rightPanel.style.width = `${newRightWidth}px`;
  }
});

document.addEventListener("mouseup", () => {
  if (!isResizing) return;
  isResizing = false;
  document.body.style.cursor = "default";
  resizer.classList.remove("active");
});

const loadGithubFiles = async (url) => {
  filesComponent.innerHTML = `<div class="loader"></div>`;

  if (!url) {
    const user_input = formInput.value.trim();
    const username = user_input.split("/").at(-2);
    const repository_name = user_input.split("/").at(-1);

    const isValidGitHubUrl = () => /^https:\/\/github\.com\//.test(user_input);

    if (!isValidGitHubUrl()) {
      filesComponent.innerHTML = `<p class="error">Please enter a valid GitHub repository URL!</p>`;
      return;
    }

    window.localStorage.setItem("github_url", user_input);

    github_repo_url = `https://api.github.com/repos/${username}/${repository_name}`;
  } else {
    console.log(url);
    const username = url.split("/").at(-2);
    const repository_name = url.split("/").at(-1);
    window.localStorage.setItem("github_url", url);
    github_repo_url = `https://api.github.com/repos/${username}/${repository_name}`;
  }

  try {
    const response = await fetchAllFiles();
    if (response !== null && !response?.message) {
      renderFiles(response);
    } else {
      filesComponent.innerHTML = `<p class="error">No files found or unable to fetch files.</p>`;
    }
  } catch (err) {
    console.error("Error loading files:", err);
    filesComponent.innerHTML = `<p class="error">An error occurred while loading files. Please try again.</p>`;
  }
};

const fetchAllFiles = (path = "") => {
  const url = `${github_repo_url}/contents/${path}`;
  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data?.message?.includes("rate limit")) {
        filesComponent.innerHTML = `<p class="error">API rate limit exceeded. Try again later.</p>`;
        return null;
      }
      return data;
    })
    .catch((err) => {
      console.error(err);
      return [];
    });
};

async function fetchFileContent(url) {
  fileContent.nextElementSibling.innerHTML = "";
  fileContent.innerHTML = `<div class="loader"></div>`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const content = await response.text();
    fileContent.textContent = content;
  } catch (error) {
    fileContent.textContent = `Error: ${error.message}`;
  }
}

document.addEventListener("click", async (event) => {
  const directoryDiv = event.target.closest(".directory");

  if (directoryDiv) {
    const toggleIcon = directoryDiv.querySelector(".toggle-icon");
    const parentPath = directoryDiv.dataset.path || "";
    const directoryName = directoryDiv.dataset.name;
    const currentPath = `${parentPath}/${directoryName}`;
    const subFilesContainer = directoryDiv.nextElementSibling;

    // Toggle visibility if subfiles already exist
    if (
      subFilesContainer &&
      subFilesContainer.classList.contains("sub-files")
    ) {
      const isHidden = subFilesContainer.style.display === "none";
      subFilesContainer.style.display = isHidden ? "block" : "none";
      toggleIcon.classList.toggle("fa-caret-right", !isHidden);
      toggleIcon.classList.toggle("fa-caret-down", isHidden);
      return;
    }

    // Fetch files for the directory if not already fetched
    const files = await fetchAllFiles(currentPath);
    if (!files || files.length === 0) {
      console.error("Failed to fetch or no files found for", currentPath);
      return;
    }

    const newSubFilesContainer = document.createElement("div");
    newSubFilesContainer.classList.add("sub-files", "ms-16px");
    newSubFilesContainer.dataset.path = currentPath;
    newSubFilesContainer.style.display = "block";
    newSubFilesContainer.innerHTML = generateFileHTML(files, currentPath);

    directoryDiv.insertAdjacentElement("afterend", newSubFilesContainer);

    toggleIcon.classList.remove("fa-caret-right");
    toggleIcon.classList.add("fa-caret-down");
  }
});

const renderFiles = (files = [], path = "") => {
  filesComponent.innerHTML = generateFileHTML(files, path);
};

const generateFileHTML = (files, path) => {
  let html = "";

  if (files?.length === 0) return;

  files.sort((a, b) => {
    if (a.type === "dir" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

  files.forEach((file) => {
    html += getFileHTML(file, path);
  });

  return html;
};

const getFileHTML = (file, path) => {
  if (file.type === "dir") {
    return `
      <div class="directory" data-name="${file.name}" data-path="${path}">
        <div>
          <i class="fa-solid fa-caret-right toggle-icon"></i>
          <i class="fa-solid fa-folder"></i>
          <p>${file.name}</p>
        </div>
      </div>`;
  } else {
    return `
      <div class="file" onclick="fetchFileContent('${file.download_url}')">
        <div>
          <div class="blank-icon"></div>
          <i class="fa-solid fa-file"></i>
          <p>${file.name}</p>
        </div>
      </div>`;
  }
};

const reset = () => {
  const filesComponent = document.querySelector(".files");
  const fileContent = document.getElementById("file-content");

  all_files = [];
  github_repo_url = null;
  formInput.value = "";
  filesComponent.innerHTML = `<div class="info">Please Load the Github Repo URL!</div>`;
  fileContent.textContent = "";
  fileContent.nextElementSibling.innerHTML = `<div class="info">Please select a file to view content</div>`;
  window.localStorage.removeItem("github_url");
};
