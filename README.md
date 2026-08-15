# Stash

Your model kit pile, on your phone. Scan a box, it looks the barcode up online,
you confirm the details, it saves to your device.

Nothing is stored on a server. Your stash lives in your phone's browser storage
and goes nowhere else.

---

## Part 1: get it running on your own computer

You only do this part once. Roughly 20 minutes.

### Step 1. Install Node.js

Go to **nodejs.org** and download the version marked LTS. Run the installer,
accept the defaults. This is the thing that runs the app's code.

To check it worked, open a terminal:

- **Windows:** press Start, type `powershell`, press Enter
- **Mac:** press Cmd+Space, type `terminal`, press Enter

Type this and press Enter:

```bash
node --version
```

If it prints a number like `v22.x.x`, you are good. If it says "command not
found", restart the terminal and try again.

### Step 2. Put the project somewhere sensible

Download and unzip this project. Move the `stash` folder somewhere you will find
it again, like your Documents folder.

In the terminal, move into that folder. The easiest way: type `cd ` (with a
space after it), then **drag the stash folder from your file manager onto the
terminal window**. It fills in the path for you. Press Enter.

To confirm you are in the right place:

```bash
ls
```

You should see `app`, `lib`, `public`, `package.json`.

### Step 3. Install the parts it needs

```bash
npm install
```

This downloads the libraries the app uses. It takes a minute or two and prints a
lot of text. Warnings are normal. Errors in red that stop it are not.

### Step 4. Run it

```bash
npm run dev
```

It will print something like `ready on http://localhost:3000`. Open that address
in your browser. The app should load with an empty stash.

Press **Ctrl+C** in the terminal to stop it.

**The camera will not work at localhost.** Browsers only allow camera access over
HTTPS. Typing a barcode by hand works fine here. Scanning starts working once
it is deployed in Part 2.

---

## Part 2: put it on the internet so your phone can use it

### Step 5. Make a GitHub account and upload the code

1. Sign up free at **github.com**.
2. Click the **+** at top right, then **New repository**.
3. Name it `stash`. Leave it Public or set Private, either works. Do not tick
   any of the "initialize with" boxes. Click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Drag in everything from the stash folder **except** the `node_modules`
   folder. That one is huge and gets rebuilt automatically.
6. Scroll down, click **Commit changes**.

### Step 6. Deploy on Vercel

1. Go to **vercel.com** and sign up with your GitHub account.
2. Click **Add New**, then **Project**.
3. Find `stash` in the list, click **Import**.
4. Change nothing. Click **Deploy**.
5. Wait about a minute. You get a URL like `stash-xyz.vercel.app`.

Open that URL on your phone. Add it to your home screen (Share, then Add to
Home Screen on iPhone; the menu, then Install app on Android) and it behaves
like a real app.

**Done. It works from here.** Everything below is optional.

---

## Part 3: optional, better barcode coverage

Out of the box, lookups use UPCitemdb, which needs no account and allows 100
lookups a day. Its coverage of model kits is patchy. If too many of your boxes
come back with nothing found, add one or both of these.

Both are free. You do this once. Your friends never need to.

### eBay: best for Chinese third-party kits and Western scale kits

1. Sign up at **developer.ebay.com**.
2. Create an application, and take the **Production** keys, not Sandbox.
3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)**.
4. In Vercel: your project, **Settings**, **Environment Variables**. Add
   `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`.
5. Go to **Deployments**, click the newest one, **Redeploy**.

Free tier is 5,000 lookups a day, which is far more than you will use.

### Rakuten: best for Bandai, Tamiya, Hasegawa, Kotobukiya

1. Sign up at **webservice.rakuten.co.jp** and register an application.
2. Copy the application ID.
3. In Vercel, add an environment variable `RAKUTEN_APP_ID`, then redeploy.

I do not know whether Rakuten's signup works from outside Japan. If it refuses
you, skip it. eBay alone is a large improvement.

---

## How the app decides what a barcode is

1. **Check digit and country prefix.** Done on your phone, offline, instantly.
   Catches misreads before wasting a lookup, and tells you where the code was
   registered. A 690 to 699 prefix means China: on a box marked Bandai, that is
   your clone warning.
2. **Your device's cache.** A barcode is only ever fetched from the internet
   once per phone.
3. **The internet**, through whichever sources you have configured.
4. **You, by hand**, when nothing lands.

Results are always shown as candidates for you to pick. Nothing saves itself.

---

## Things worth knowing

**Back up.** Settings has a full JSON export including photos. Clearing your
browser data wipes the stash, and there is no server copy. Export occasionally.

**Sharing.** The Report screen draws a PNG of your pile: counts, breakdown by
maker and grade, total value. Send it to your friends however you like. There is
no shared account and no sync, by design.

**Your friends.** They just open the same URL. Their stash is their own, entirely
separate, on their own phone.

**Listing titles are messy.** Marketplace titles come back like "Bandai HG 1/144
RX-78-2 Gundam Model Kit NEW US Seller". The app strips the noise with pattern
rules and fills the form in. It gets it roughly right, which is why you confirm
every kit before it saves.

## If something goes wrong

**The camera does nothing.** Check the URL starts with `https`. On iPhone,
Settings, Safari, Camera, set to Ask or Allow.

**Every scan says nothing found.** Expected with UPCitemdb alone, especially for
third-party kits. Add eBay credentials, Part 3.

**Vercel says the build failed.** Nearly always because `node_modules` got
uploaded. Delete that folder from the GitHub repo and it will redeploy.

**Everything vanished.** Browser data was cleared. Restore from a backup file in
Settings. If you have no backup, it is gone.
