# Landing Page — FEA Júnior USP (Consultoria)

Single-page landing site with a 4-step diagnosis form that creates a **card in Pipefy** on submit.

## How the Pipefy integration works

The form does **not** call Pipefy from the browser — that would expose the API token to
anyone viewing the page source. Instead:

```
Browser (index.html)  ──POST /api/pipefy──►  Vercel Serverless Function  ──GraphQL──►  Pipefy
                                              (holds PIPEFY_TOKEN secret)
```

- `index.html` — the page + form. On submit it POSTs the form data as JSON to `/api/pipefy`.
- `api/pipefy.js` — the secure proxy. Reads the token from env vars and runs the
  `createCard` mutation against Pipefy's GraphQL API.

---

## Setup (one time)

### 1. Get your Pipefy API token

1. Log in to Pipefy.
2. Go to **https://app.pipefy.com/tokens** (or *Profile → Account preferences → Personal Access Tokens*).
3. Click **Generate new token**, give it a name (e.g. `landing-feajr`), copy the value.
   ⚠️ It's shown only once — keep it safe, never paste it into the repo.

### 2. Get your Pipe ID

Open the pipe in Pipefy. The number in the URL is the pipe id:

```
https://app.pipefy.com/pipes/123456789
                                ^^^^^^^^^  ← PIPEFY_PIPE_ID
```

### 3. Get your field IDs (to map the form to Pipefy fields)

Open Pipefy's GraphQL explorer at **https://app.pipefy.com/graphiql** (uses your logged-in
session — no token needed here) and run, replacing `123456789` with your pipe id:

```graphql
{
  pipe(id: 123456789) {
    start_form_fields { id label type }
  }
}
```

Each `id` it returns is what you paste into the `FIELD_MAP` at the top of
[`api/pipefy.js`](api/pipefy.js). Match them to the form by label:

| Form field | Meaning            | FIELD_MAP key |
|------------|--------------------|---------------|
| Nome       | Lead name          | `nome`        |
| E-mail     | Email              | `email`       |
| WhatsApp   | Phone              | `tel`         |
| Empresa    | Company            | `empresa`     |
| Setor      | Industry/sector    | `setor`       |
| Estágio    | Business stage     | `estagio`     |
| Faturamento| Monthly revenue    | `fat`         |
| Soluções   | Services (multi)   | `servicos`    |
| Colaboradores | Headcount       | `col`         |
| Desafio    | Main challenge     | `desafio`     |
| Investimento | Budget horizon   | `inv`         |
| Origem     | How they found us  | `origem`      |

> Leave a `FIELD_MAP` value as `""` to skip that field. The `servicos` field must map to a
> Pipefy **checklist** or **multiselect** field (it sends an array). The card **title** is set
> automatically to `Name — Company`, so you don't need to map a title field.

### 4. Add the env vars in Vercel

In the Vercel project → **Settings → Environment Variables**, add (for Production + Preview):

| Name             | Value                          |
|------------------|--------------------------------|
| `PIPEFY_TOKEN`   | the token from step 1          |
| `PIPEFY_PIPE_ID` | the pipe id from step 2        |

Redeploy after adding them.

### 5. Deploy

Connect this GitHub repo to Vercel (no build settings needed — it's a static site + an
`/api` function). Every push to the main branch deploys automatically.

---

## Local testing

```bash
npm i -g vercel        # once
cp .env.example .env.local   # fill in real values
vercel dev             # serves the page + /api/pipefy locally
```

Then open the local URL, fill the form, and confirm a card appears in your pipe.

## Troubleshooting

- **500 "Servidor não configurado"** → env vars missing/misspelled in Vercel.
- **502 "Falha ao registrar o lead"** → token invalid, wrong pipe id, or a field id in
  `FIELD_MAP` doesn't exist / has the wrong type. Check the function logs in Vercel.
- **Card created but fields empty** → field ids in `FIELD_MAP` don't match the pipe; re-run
  the GraphiQL query in step 3.
