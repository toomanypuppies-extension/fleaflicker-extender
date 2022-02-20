document.body.style.background = 'blue';

const extenstion = document.createElement('div');
extenstion.id = 'extensionBody';
const mainBody = document.getElementById('body');

mainBody.insertAdjacentElement('afterend', extenstion);

const extensionBody = document.getElementById('extensionBody');

extensionBody.style.width = '600px';
extensionBody.style.height = 'calc(100% - 50px)';
extensionBody.style.background = 'orange';
extensionBody.style.position = 'fixed';
extensionBody.style.top = '50px';
extensionBody.style.right = '0';


mainBody.style.width = 'calc(100% - 600px)';

const formHtml = `
<form>
  <label>
    Team
    <select>
      <option value="SEA">Seattle</option>
    </select>
  </label>
</form>
`

// const form = () => {
//   const formHtml = `
//   <form>
//     <label>
//       Team
//       <select>
//         <option value="SEA">Seattle</option>
//       </select>
//     </label>
//   </form>
// `
//   return formHtml;
// }

extensionBody.innerHTML = formHtml;