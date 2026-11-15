import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ids-locale", "en"));
});

// Browser fixtures exercise the released UI without changing real tenant data.
// The Go + PostgreSQL suite exercises persistence and delivery separately.
async function workspace(page: Page) {
  const user = {user_id:"user",workspace_id:"workspace",workspace_name:"Design studio",name:"Studio owner",role:"owner",email:"owner@example.test"};
  const account = {id:"account",username:"studio",status:"connected",account_type:"BUSINESS",provider:"meta",scopes:[]};
  const rule = {id:"rule",name:"Price replies",account_username:"studio",keywords:["price"],is_active:true};
  let settings = {profile:user,workspace:{id:"workspace",name:"Design studio",role:"owner"},language:"en",notifications_enabled:true,webhook:{queued:0,failed_last_24h:0},meta_configured:true,webhook_url:"https://example.test/webhooks"};
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname.slice("/api/v1".length);
    const method = route.request().method();
    if (path === "/settings" && method === "PATCH") {
      const change = route.request().postDataJSON();
      settings = {...settings,notifications_enabled:change.notifications_enabled,profile:{...user,name:change.name}};
      return route.fulfill({json:{message:"saved"}});
    }
    if (path === "/automations" && method === "POST") return route.fulfill({status:201,json:{id:"new-rule"}});
    const results:Record<string,unknown> = {
      "/me":{user,csrf_token:"browser-fixture"}, "/workspaces":{items:[{id:"workspace",name:"Design studio",role:"owner"}]},
      "/settings":settings, "/analytics/summary":{summary:{comments:8,eligible_triggers:4,replies_sent:2,conversion:25,series:[]}},
      "/instagram/accounts":{items:[account]}, "/automations":{items:[rule]},
      "/instagram/accounts/account/media":{items:[{id:"post",caption:"Studio reel",media_type:"VIDEO",media_product_type:"REELS",timestamp:"2026-01-01T12:00:00Z"}]},
    };
    if (!(path in results) || method !== "GET") return route.fulfill({status:404,json:{error:{code:"unexpected_request",message:path}}});
    return route.fulfill({json:results[path]});
  });
  return errors;
}

test("public registration and returning sign-in use Instagram", async ({page}) => {
  await page.route("**/api/v1/me", route => route.fulfill({status:401,json:{error:{code:"unauthorized",message:"Sign in"}}}));
  await page.route("**/api/v1/auth/instagram/status", route => route.fulfill({json:{enabled:true}}));
  for (const [path, title] of [["/register","Create an account with Instagram"],["/login","Sign in with Instagram"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading",{name:title})).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Continue with Instagram"})).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("button",{name:"Continue with Instagram"})).toBeEnabled();
  }
});

for (const mode of [{width:1440,height:900,theme:"dark"},{width:390,height:844,theme:"light"}]) {
  test("dashboard and settings · "+mode.width+" · "+mode.theme, async ({page}, info) => {
    const errors=await workspace(page);
    await page.setViewportSize({width:mode.width,height:mode.height});
    await page.addInitScript(theme=>localStorage.setItem("ids-theme",theme),mode.theme);
    await page.goto("/app");
    await expect(page.getByRole("heading",{name:"Dashboard",exact:true})).toBeVisible();
    await expect(page.getByText("25%",{exact:true})).toBeVisible();
    await expect(page.locator(".overview-next")).toHaveCount(0);
    await expect(page.locator(".stat-card")).toHaveCount(4);
    await info.attach("dashboard",{body:await page.screenshot(),contentType:"image/png"});
    await page.goto("/app/settings");
    await expect(page.getByText("owner@example.test",{exact:true})).toBeVisible();
    await expect(page.getByText("Failures in the last 24 hours")).not.toBeVisible();
    const toggle=page.getByRole("switch",{name:"Notifications"});
    await expect(toggle).toBeChecked();
    await info.attach("settings",{body:await page.screenshot(),contentType:"image/png"});
    await toggle.uncheck();
    await page.getByRole("button",{name:"Save changes"}).click();
    await expect(page.getByRole("status").filter({hasText:"Settings saved"})).toBeVisible();
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await page.getByText("Integration status",{exact:true}).click();
    await expect(page.getByText("Queued comments",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Security and privacy"}).click();
    await expect(page.getByRole("link",{name:"Manage active sessions"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("builder posts grouped replies and previews the message",async({page})=>{
  const errors=await workspace(page);
  await page.goto("/app/automations/new");
  await page.getByRole("button",{name:/Studio reel/}).click();
  const next=page.getByRole("button",{name:"Continue",exact:true});
  await next.click();
  await page.getByRole("button",{name:"Use keyword groups"}).click();
  await page.getByLabel("Group name",{exact:true}).fill("Price");
  await page.getByLabel("Primary keywords",{exact:true}).fill("narx");
  await page.getByLabel("Synonyms",{exact:true}).fill("qancha, цена");
  await next.click();
  await page.getByRole("textbox",{name:"Direct replies 1"}).fill("Price 42");
  await page.getByText("Preview message",{exact:true}).click();
  await expect(page.locator(".kg-preview p")).toHaveText("Price 42");
  await page.locator(".kg-templates").filter({has:page.getByRole("heading",{name:"Public replies"})}).getByRole("button",{name:"Add reply"}).click();
  await page.getByRole("textbox",{name:"Public replies 1"}).fill("Check your Direct");
  await next.click();
  const sent=page.waitForRequest(r=>new URL(r.url()).pathname==="/api/v1/automations"&&r.method()==="POST");
  await page.getByRole("button",{name:"Save automation"}).click();
  const body=(await sent).postDataJSON();
  expect(body.media_ids).toEqual(["post"]);
  expect(body.keyword_groups[0]).toMatchObject({name:"Price",dm_templates:[{text:"Price 42",enabled:true}],public_templates:[{text:"Check your Direct",enabled:true}]});
  expect(body.keyword_groups[0].variants.map((v:{text:string})=>v.text)).toEqual(["narx","qancha","цена"]);
  expect(errors).toEqual([]);
});
