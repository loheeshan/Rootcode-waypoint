# Create the GitHub repository and push

## 1. Create an empty repository

1. Sign in to [GitHub's new repository page](https://github.com/new).
2. Choose your account or team organization as owner.
3. Use `TeamName_SolutionName` if the competition requires that naming convention, or use `rootcode-waypoint`.
4. Select visibility according to your team's competition requirements.
5. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unselected. Those files/history are already prepared locally.
6. Click **Create repository**, then copy its HTTPS URL.

## 2. Connect the prepared local repository

The local repository contains:

- `main`: one empty bootstrap commit.
- `dev`: the same bootstrap commit.
- `chore/repository-foundation`: the application foundation commit; this is the checked-out branch.

This gives the first foundation pull request a clean shared base without committing application work directly on `main` or `dev`.

In PowerShell, replace `YOUR_USERNAME` and `YOUR_REPOSITORY` with the actual owner and repository names:

```powershell
Set-Location D:\Rootcode
git status
git log --oneline --decorate -3
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git remote -v
git push -u origin main
git push -u origin dev
git push -u origin chore/repository-foundation
```

If `origin` already exists, inspect `git remote -v` first; change it with `git remote set-url origin ACTUAL_REPOSITORY_URL` only if it points to the wrong repository. Do not force push.

Git may open Git Credential Manager's browser sign-in. Use that sign-in flow or your approved SSH setup. Do not put access tokens or passwords in the remote URL. GitHub account passwords cannot be used as Git HTTPS passwords.

## 3. Open and merge the foundation PR

In GitHub choose **Pull requests → New pull request**, then select:

```text
base: dev
compare: chore/repository-foundation
```

Suggested title: `chore(repo): scaffold Waypoint monorepo and development tooling`.

Review the files and check CI. Merge after review, then begin feature work from the updated `dev` branch. Keep `main` for the reviewed release. You may set `dev` as the default branch once it contains the merged foundation, so teammates clone the working integration branch by default.

## 4. Team access and protection

Add teammates in the repository's access settings. Configure rulesets/branch protection for `main` and `dev` to require pull requests, review, and the `clients` and `api` checks after those checks have run at least once. Restrict force pushes and branch deletion. Available protection options depend on the GitHub plan and repository visibility.

## 5. Normal development

```powershell
git switch dev
git pull --ff-only origin dev
git switch -c feature/api-orders
# Implement and run the relevant checks.
git add apps/api/app/orders
git diff --cached
git commit -m "feat(api): add order endpoints"
git push -u origin feature/api-orders
```

Open `feature/api-orders → dev`. Release through `dev → main` after integration checks. Do not push feature commits directly to the permanent branches.

For a second computer or teammate:

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
Set-Location YOUR_REPOSITORY
git switch dev
```

Then follow the root README's dependency and environment setup.

GitHub's reference: [Adding locally hosted code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
