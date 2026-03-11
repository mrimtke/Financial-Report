
const form=document.getElementById("entryForm")
const cardList=document.getElementById("cardList")

function normalizeData(arr){
 return arr.map(x=>({
  id:Number(x.id),
  year:Number(x.year),
  month:Number(x.month),
  title:String(x.title),
  amount:Number(x.amount)
 }))
}

let data=normalizeData(JSON.parse(localStorage.getItem("finance_data")||"[]"))

function save(){
 localStorage.setItem("finance_data",JSON.stringify(data))
}

function render(){
 cardList.innerHTML=""
 data.forEach(item=>{
  const card=document.createElement("div")
  card.className="card"
  card.innerHTML=`
  <b>${item.year}/${item.month}</b>
  ${item.title}
  ${item.amount}円
  <button class="editBtn" data-id="${item.id}">編集</button>
  <button class="deleteBtn" data-id="${item.id}">削除</button>
  `
  cardList.appendChild(card)
 })
}

form.addEventListener("submit",e=>{
 e.preventDefault()

 const item={
  id:Date.now(),
  year:Number(document.getElementById("year").value),
  month:Number(document.getElementById("month").value),
  title:document.getElementById("title").value,
  amount:Number(document.getElementById("amount").value)
 }

 data.push(item)
 save()
 render()
 form.reset()
})

cardList.addEventListener("click",e=>{

 const id=Number(e.target.dataset.id)
 if(!id)return

 if(e.target.classList.contains("deleteBtn")){
  data=data.filter(x=>x.id!==id)
  save()
  render()
 }

 if(e.target.classList.contains("editBtn")){
  const item=data.find(x=>x.id===id)
  if(!item)return

  const title=prompt("内容編集",item.title)
  const amount=prompt("金額編集",item.amount)

  if(title!==null)item.title=title
  if(amount!==null)item.amount=Number(amount)

  save()
  render()
 }

})

render()
