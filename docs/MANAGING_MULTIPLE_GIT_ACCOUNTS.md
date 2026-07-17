# Managing Multiple Git Accounts on One Machine (HTTPS)

This guide explains how to cleanly switch between different GitHub accounts (e.g., your personal `leonclem` account and a secondary/work account like `spi-research-projects`) on a per-project basis without them interfering with each other.

Because you are using HTTPS, Windows Credential Manager will try to use a single global login for all `github.com` URLs by default. To prevent this, we configure Git to recognize each account separately.

---

## Step 1: Open the Project Workspace
Open the specific project directory where you want to use your secondary/work account in your IDE (e.g., Cursor) or terminal.

---

## Step 2: Configure Your Name & Email for This Project
By default, Git uses your computer's global name and email. To override this for **just this specific project folder**, run these commands in your project's terminal:

```powershell
git config --local user.name "Your Secondary Name"
git config --local user.email "your-secondary-email@example.com"
```
*(Note: Omitting `--global` and using `--local` ensures this change only affects the current folder).*

---

## Step 3: Embed Your Username in the Remote URL
This is the key step that forces Windows to keep separate login sessions. By adding your secondary username to the repository URL, Windows Credential Manager treats it as a unique connection.

1. **Check your current remote URL:**
   ```powershell
   git remote -v
   ```
   *You will likely see something like:* `https://github.com/org-name/repo-name.git`

2. **Update the URL to include your secondary username:**
   Replace `SECONDARY_USERNAME`, `ORG_NAME`, and `REPO_NAME` below with your actual details:
   ```powershell
   git remote set-url origin https://SECONDARY_USERNAME@github.com/ORG_NAME/REPO_NAME.git
   ```
   *Example:*
   ```powershell
   git remote set-url origin https://spi-research-projects@github.com/spi-research-projects/another-project.git
   ```

---

## Step 4: Run a Push and Log In
Now, push your changes to trigger the login popup:

```powershell
git push -u origin main
```
*(Replace `main` with your active branch name if different, like `master` or `develop`).*

### What will happen:
1. Windows Credential Manager will open a pop-up window.
2. Select **"Sign in with your browser"** (or use a GitHub Personal Access Token / PAT if preferred).
3. Log in with your **secondary GitHub account**.

Windows will now save this secondary account's credentials and bind them specifically to URLs containing your secondary username, leaving your primary `leonclem` credentials safe and untouched!

---

## Verifying Your Setup
To verify everything is set up correctly for your current project, you can inspect its configuration:

```powershell
# Verify name and email for this folder (should show secondary details)
git config --local user.name
git config --local user.email

# Verify the remote URL contains the secondary username
git remote -v
```
