export const qwebSample = /* xml */ `
<h1>Qweb examples</h1>
<div>
    <t t-set="foo1" t-value="2 + 1"></t>
    <t t-esc="object">foo</t>
    <t t-raw="object">foo_raw</t>
    <t t-esc="invisible"></t>
</div>


<div>
    <p t-esc="value">the value</p>
</div>

<div>
    <t t-if="condition">
        <p>if1</p>
    </t>
    <t t-if="condition">
        <p>if2</p>
    </t>
    <t t-elif="condition">
        <p>elif2.1</p>
    </t>
    <t t-else="condition">
        <p>elif2.1</p>

        <t t-if="condition">
            <p>if2.1.1</p>
        </t>
        <t t-elif="condition">
            <p>elif2.1.2</p>
        </t>
        <t t-else="condition">
            <p>elif2.1.3</p>
        </t>
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


<t t-set="" t-value=""/>

t-esc="record."
t-raw="record."
<t t-esc="record."></t>
<t t-raw="record."></t>

<t t-if="record.">
</t>
<t t-else="">
</t>

<t t-if="record.">
</t>
<t t-elif="record.">
</t>
<t t-else="">
</t>

t-foreach="" t-as=""
<p t-foreach="" t-as="">
</p> 