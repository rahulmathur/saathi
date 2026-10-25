// Where the website sends survey answers, waitlist sign-ups and stories.
// Uses the Worker's workers.dev address until api.saathi.travel is connected;
// then change this to 'https://api.saathi.travel' and redeploy the site.
// Add ?api=http://localhost:8787 to any page to test locally.
window.SAATHI_API = 'https://saathi-api.rahul-mathur.workers.dev';
