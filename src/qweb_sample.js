export const qwebSample = /* xml */ `
<h1>Qweb examples</h1>
<div>
    <t t-set="foo1" t-value="2 + 1"></t>
    <t t-esc="foo1"></t>
</div>


<div>
    <p><span t-esc="value">the value</span></p>
</div>

<div>
    <t t-if="condition">
        <p>ok</p>
    </t>
</div>

<div>
    <p t-if="condition">ok</p>
</div>
<div>
    <p t-if="user.birthday == today()">Happy birthday!</p>
    <p t-elif="user.login == 'root'">Welcome master!</p>
    <p t-else="">Welcome!</p>
</div>

<t t-foreach="[1, 2, 3]" t-as="i">
    <p><t t-esc="i"></t></p>
</t>

<p t-foreach="[1, 2, 3]" t-as="i">
    <t t-esc="i"></t>
</p>

<t t-set="foo2">
    <li>ok</li>
</t>
<t t-esc="foo2"></t>

<t t-call="other-template"></t>

<t t-call="other-template">
    <t t-set="foo3" t-value="1"></t>
</t>

<div>
    This template was called with content:
    <t t-raw="0"></t>
</div>
`;
